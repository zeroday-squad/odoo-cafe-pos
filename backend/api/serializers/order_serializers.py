from rest_framework import serializers
from core.models import Order, OrderItem, POSSession, Table, Customer, User, Coupon, Product, Payment
from api.serializers.product_serializers import ProductSerializer
from api.serializers.floor_serializers import TableSerializer
from api.serializers.customer_serializers import CustomerSerializer
from api.serializers.staff_serializers import StaffListSerializer
from api.serializers.coupon_serializers import CouponSerializer

class OrderItemReadSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'quantity', 'unit_price', 'line_total', 'discount', 'kds_status']


class OrderItemWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product'
    )

    class Meta:
        model = OrderItem
        fields = ['product_id', 'quantity', 'unit_price']

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'method', 'amount_paid', 'change_due', 'transaction_ref', 'paid_at']


class OrderReadSerializer(serializers.ModelSerializer):
    session_id = serializers.PrimaryKeyRelatedField(source='session', read_only=True)
    table = TableSerializer(read_only=True)
    customer = CustomerSerializer(read_only=True)
    employee = StaffListSerializer(read_only=True)
    coupon = CouponSerializer(read_only=True)
    payment = PaymentSerializer(read_only=True)
    items = OrderItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'session_id', 'table', 'customer',
            'employee', 'status', 'kds_status', 'subtotal', 'tax_amount',
            'discount', 'total', 'coupon', 'payment', 'created_at', 'updated_at', 'items'
        ]


class OrderCreateSerializer(serializers.ModelSerializer):
    session_id = serializers.PrimaryKeyRelatedField(
        queryset=POSSession.objects.filter(status='open'),
        source='session',
        error_messages={'does_not_exist': 'An active open session is required.'}
    )
    table_id = serializers.PrimaryKeyRelatedField(
        queryset=Table.objects.all(),
        source='table'
    )
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='employee'
    )

    class Meta:
        model = Order
        fields = ['id', 'session_id', 'table_id', 'employee_id', 'status']

    def validate(self, data):
        table = data.get('table')
        if table and not table.is_active:
            raise serializers.ValidationError({'table_id': 'This table is inactive.'})

        # Prevent multiple draft orders on the same table
        if table and Order.objects.filter(table=table, status='draft').exists():
            raise serializers.ValidationError(
                {'table_id': 'A draft order already exists for this table.'}
            )
        return data


class OrderUpdateSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        source='customer',
        required=False,
        allow_null=True
    )
    coupon_id = serializers.PrimaryKeyRelatedField(
        queryset=Coupon.objects.all(),
        source='coupon',
        required=False,
        allow_null=True
    )

    class Meta:
        model = Order
        fields = ['customer_id', 'coupon_id']

    def validate_coupon_id(self, value):
        if value and not value.is_active:
            raise serializers.ValidationError("This coupon code is inactive or invalid.")
        return value
