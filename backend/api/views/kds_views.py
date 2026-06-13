from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from core.models import Order, OrderItem
from core.permissions import IsKitchenOrAdmin
from api.serializers.kds_serializers import KitchenTicketSerializer, KitchenTicketItemSerializer

class KDSOrderListView(APIView):
    permission_classes = [IsKitchenOrAdmin]

    def get(self, request):
        # Fresh reads, oldest first
        orders = Order.objects.filter(
            kds_status__in=['to_cook', 'preparing']
        ).order_by('created_at')
        
        serializer = KitchenTicketSerializer(orders, many=True)
        return Response(serializer.data)


class KDSAdvanceStatusView(APIView):
    permission_classes = [IsKitchenOrAdmin]

    def put(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        current = order.kds_status
        if current == 'to_cook':
            order.kds_status = 'preparing'
        elif current == 'preparing':
            # Verify all KDS-applicable items are completed before advancing the ticket
            pending_items = order.items.filter(
                product__show_in_kds=True,
                kds_status='pending'
            ).exists()
            if pending_items:
                return Response(
                    {"detail": "Cannot complete order. Some items are still pending cooking."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            order.kds_status = 'completed'
        else:
            return Response(
                {"detail": "Order has no further valid KDS status transitions."},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.save()
        return Response(KitchenTicketSerializer(order).data, status=status.HTTP_200_OK)


class KDSToggleItemView(APIView):
    permission_classes = [IsKitchenOrAdmin]

    def put(self, request, pk):
        try:
            item = OrderItem.objects.get(pk=pk)
        except OrderItem.DoesNotExist:
            return Response({"detail": "Order item not found."}, status=status.HTTP_404_NOT_FOUND)

        # Real toggling: completed <-> pending
        if item.order.kds_status == 'completed':
            return Response(
                {"detail": "Cannot toggle items for a completed kitchen order ticket."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if item.kds_status == 'completed':
            item.kds_status = 'pending'
        else:
            item.kds_status = 'completed'
            
        item.save()
        return Response(KitchenTicketItemSerializer(item).data, status=status.HTTP_200_OK)
