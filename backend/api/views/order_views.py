from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from django.core.mail import send_mail
from rest_framework import status, serializers
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from core.models import Order, OrderItem, POSSession, Table, Customer, User, Payment, PaymentMethod
from core.permissions import IsEmployeeOrAdmin
from api.serializers.order_serializers import (
    OrderReadSerializer, OrderCreateSerializer, OrderUpdateSerializer,
    OrderItemReadSerializer, OrderItemWriteSerializer
)

def recalculate_order_totals(order):
    order.refresh_from_db()
    subtotal = 0
    # 1. Update line totals and line discounts for all items
    for item in order.items.select_related('product').all():
        base_line_total = item.unit_price * item.quantity
        
        # Check active product-level promotions
        from core.models import Promotion
        promo = Promotion.objects.filter(
            promo_type='product',
            product=item.product,
            is_active=True,
            min_quantity__lte=item.quantity
        ).order_by('-discount_value').first()
        
        item_discount = 0
        if promo:
            if promo.discount_type == 'percent':
                item_discount = base_line_total * (promo.discount_value / 100)
            elif promo.discount_type == 'fixed':
                item_discount = min(promo.discount_value * item.quantity, base_line_total)
        
        item.discount = item_discount
        item.line_total = base_line_total - item_discount
        item.save()
        
        subtotal += base_line_total

    # 2. Calculate tax amount (tax is calculated on the discounted line_total)
    tax_amount = 0
    for item in order.items.select_related('product').all():
        product_tax_rate = item.product.tax if (item.product and item.product.tax is not None) else 0
        tax_amount += item.line_total * (product_tax_rate / 100)

    # 3. Calculate order-level promotion discount
    order_promo_discount = 0
    from core.models import Promotion
    order_promo = Promotion.objects.filter(
        promo_type='order',
        is_active=True,
        min_order_amount__lte=subtotal
    ).order_by('-discount_value').first()
    
    if order_promo:
        if order_promo.discount_type == 'percent':
            order_promo_discount = subtotal * (order_promo.discount_value / 100)
        elif order_promo.discount_type == 'fixed':
            order_promo_discount = min(order_promo.discount_value, subtotal)

    # 4. Calculate coupon discount
    coupon_discount = 0
    if order.coupon and order.coupon.is_active:
        if order.coupon.discount_type == 'percent':
            coupon_discount = subtotal * (order.coupon.discount_value / 100)
        elif order.coupon.discount_type == 'fixed':
            coupon_discount = min(order.coupon.discount_value, subtotal)

    # Combined discount = item-level discounts + order-level promo + coupon
    total_item_discounts = sum(item.discount for item in order.items.all())
    total_discount = total_item_discounts + order_promo_discount + coupon_discount
    
    # Cap total_discount at subtotal + tax_amount
    total_discount = min(total_discount, subtotal + tax_amount)
    
    order.subtotal = subtotal
    order.tax_amount = tax_amount
    order.discount = total_discount
    order.total = max(subtotal + tax_amount - total_discount, 0)
    order.save()


class OrderPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'


class OrderViewSet(ModelViewSet):
    permission_classes = [IsEmployeeOrAdmin]
    pagination_class = OrderPagination

    def get_queryset(self):
        # Prevent caching and run fresh reads
        queryset = Order.objects.select_related('table', 'customer', 'employee', 'coupon').prefetch_related('items__product').all().order_by('-created_at')
        
        session_id = self.request.query_params.get('session')
        if session_id:
            queryset = queryset.filter(session_id=session_id)
            
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        table_id = self.request.query_params.get('table')
        if table_id:
            queryset = queryset.filter(table_id=table_id)
            
        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(order_number__icontains=search_query) |
                Q(customer__name__icontains=search_query)
            )
            
        return queryset

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return OrderReadSerializer
        elif self.action == 'create':
            return OrderCreateSerializer
        return OrderUpdateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        recalculate_order_totals(order)
        return Response(OrderReadSerializer(order).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Prevent updates on non-draft orders
        if instance.status != 'draft':
            return Response({"detail": "Only draft orders can be updated."}, status=status.HTTP_400_BAD_REQUEST)
            
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        recalculate_order_totals(order)
        return Response(OrderReadSerializer(order).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Only draft orders can be deleted
        if instance.status != 'draft':
            return Response({"detail": "Only draft orders can be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class OrderItemView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'draft':
            return Response({"detail": "Items can only be added to draft orders."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = OrderItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        product = serializer.validated_data['product']
        quantity = serializer.validated_data['quantity']
        unit_price = serializer.validated_data['unit_price']

        item, created = OrderItem.objects.get_or_create(
            order=order,
            product=product,
            defaults={
                'quantity': quantity,
                'unit_price': unit_price,
                'line_total': 0
            }
        )
        if not created:
            item.quantity += quantity
            item.save()

        recalculate_order_totals(order)
        return Response(OrderReadSerializer(order).data, status=status.HTTP_200_OK)


class OrderItemDetailView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def put(self, request, pk, item_id):
        try:
            order = Order.objects.get(pk=pk)
            item = OrderItem.objects.get(pk=item_id, order=order)
        except (Order.DoesNotExist, OrderItem.DoesNotExist):
            return Response({"detail": "Order or Item not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'draft':
            return Response({"detail": "Items can only be modified on draft orders."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = OrderItemWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if 'quantity' in serializer.validated_data:
            item.quantity = serializer.validated_data['quantity']
        if 'unit_price' in serializer.validated_data:
            item.unit_price = serializer.validated_data['unit_price']
        
        item.save()
        recalculate_order_totals(order)
        return Response(OrderReadSerializer(order).data, status=status.HTTP_200_OK)

    def delete(self, request, pk, item_id):
        try:
            order = Order.objects.get(pk=pk)
            item = OrderItem.objects.get(pk=item_id, order=order)
        except (Order.DoesNotExist, OrderItem.DoesNotExist):
            return Response({"detail": "Order or Item not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'draft':
            return Response({"detail": "Items can only be deleted from draft orders."}, status=status.HTTP_400_BAD_REQUEST)

        item.delete()

        # If no items remain, automatically delete the draft order
        if not order.items.exists():
            order.delete()
            return Response({"detail": "Order deleted because it has no items."}, status=status.HTTP_204_NO_CONTENT)

        recalculate_order_totals(order)
        return Response(OrderReadSerializer(order).data, status=status.HTTP_200_OK)


class SendKitchenView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'draft':
            return Response({"detail": "Only draft orders can be sent to the kitchen."}, status=status.HTTP_400_BAD_REQUEST)

        if order.kds_status in ['to_cook', 'preparing', 'completed']:
            return Response({"detail": "Order is already sent or completed."}, status=status.HTTP_400_BAD_REQUEST)

        order.kds_status = 'to_cook'
        order.save()

        return Response({
            "message": "Order sent to kitchen",
            "kds_status": "to_cook"
        }, status=status.HTTP_200_OK)


class PayOrderView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status == 'paid':
            return Response({"detail": "Order is already paid."}, status=status.HTTP_400_BAD_REQUEST)

        method = request.data.get('method')
        amount_paid_raw = request.data.get('amount_paid')
        transaction_ref = request.data.get('transaction_ref', '')

        if method not in ['cash', 'card', 'upi']:
            return Response({"detail": "Invalid payment method."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount_paid = float(amount_paid_raw)
        except (ValueError, TypeError):
            return Response({"detail": "Valid amount_paid is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Payment Method Enabled Check
        pm = PaymentMethod.objects.filter(method=method).first()
        if not pm or not pm.is_enabled:
            return Response({"detail": f"Payment method '{method}' is currently disabled."}, status=status.HTTP_400_BAD_REQUEST)

        order_total = float(order.total)
        
        # Validate amounts
        if method in ['upi', 'card']:
            if abs(amount_paid - order_total) > 0.01:
                return Response({"detail": f"Card and UPI payments must match the total exactly ({order_total})."}, status=status.HTTP_400_BAD_REQUEST)
            change_due = 0.0
        else:
            if amount_paid < order_total:
                return Response({"detail": f"Amount paid must be at least the order total ({order_total})."}, status=status.HTTP_400_BAD_REQUEST)
            change_due = amount_paid - order_total

        # Save payment details inside transaction.atomic()
        with transaction.atomic():
            Payment.objects.create(
                order=order,
                method=method,
                amount_paid=amount_paid,
                change_due=change_due,
                transaction_ref=transaction_ref
            )
            order.status = 'paid'
            order.save()

        # Freeing the table is achieved automatically because TableSerializer checks for open draft orders, 
        # which this order is no longer considered since status is now 'paid'.

        return Response(OrderReadSerializer(order).data, status=status.HTTP_200_OK)


class SendReceiptView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'paid':
            return Response({"detail": "Receipts can only be sent for paid orders."}, status=status.HTTP_400_BAD_REQUEST)

        email = request.data.get('email')
        if not email:
            return Response({"detail": "Email recipient is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate email field structure
        email_serializer = serializers.EmailField()
        try:
            email_serializer.to_internal_value(email)
        except serializers.ValidationError:
            return Response({"detail": "A valid email address is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Build Plain Text Receipt
        receipt = f"CafeFlow POS - RECEIPT FOR ORDER {order.order_number}\n"
        receipt += "========================================\n"
        receipt += f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}\n"
        receipt += f"Server: {order.employee.name if order.employee else 'Unknown'}\n"
        receipt += f"Table: {order.table.number if order.table else 'Takeaway'}\n"
        receipt += "========================================\n"
        for item in order.items.select_related('product').all():
            name = item.product.name if item.product else "Product"
            receipt += f"{name:<20} x{item.quantity:<3} ${item.line_total:>8.2f}\n"
            if item.discount > 0:
                receipt += f"  (Promo Discount: -${item.discount:.2f})\n"
        receipt += "----------------------------------------\n"
        receipt += f"Subtotal:            ${order.subtotal:>8.2f}\n"
        receipt += f"Tax:                 ${order.tax_amount:>8.2f}\n"
        receipt += f"Discount:            -${order.discount:>8.2f}\n"
        receipt += "========================================\n"
        receipt += f"TOTAL:               ${order.total:>8.2f}\n"
        receipt += "========================================\n"
        receipt += "Thank you for dining with us!\n"

        send_mail(
            subject=f"Receipt for Order {order.order_number}",
            message=receipt,
            from_email="receipts@cafeflow.com",
            recipient_list=[email],
            fail_silently=False
        )

        return Response({"sent": True}, status=status.HTTP_200_OK)
