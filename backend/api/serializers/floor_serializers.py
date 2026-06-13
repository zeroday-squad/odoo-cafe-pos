from rest_framework import serializers
from core.models import Floor, Table, Order

class TableSerializer(serializers.ModelSerializer):
    floor_id = serializers.PrimaryKeyRelatedField(
        queryset=Floor.objects.all(),
        source='floor'
    )
    has_active_order   = serializers.SerializerMethodField()
    active_order_total = serializers.SerializerMethodField()

    class Meta:
        model  = Table
        fields = ['id', 'number', 'seats', 'is_active', 'floor_id',
                  'has_active_order', 'active_order_total']

    def get_has_active_order(self, obj):
        return Order.objects.filter(table=obj, status='draft').exists()

    def get_active_order_total(self, obj):
        order = Order.objects.filter(table=obj, status='draft').first()
        return str(order.total) if order else None


class FloorSerializer(serializers.ModelSerializer):
    tables = TableSerializer(many=True, read_only=True)

    class Meta:
        model  = Floor
        fields = ['id', 'name', 'tables']
