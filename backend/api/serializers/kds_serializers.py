from rest_framework import serializers
from core.models import Order, OrderItem

class KitchenTicketItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product_name', 'quantity', 'kds_status']

    def get_product_name(self, obj):
        return obj.product.name if obj.product else "Unknown Product"


class KitchenTicketSerializer(serializers.ModelSerializer):
    table_number = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'order_number', 'table_number', 'kds_status', 'created_at', 'items']

    def get_table_number(self, obj):
        return obj.table.number if obj.table else None

    def get_items(self, obj):
        # Only include items that are marked to show in KDS
        qs = obj.items.filter(product__show_in_kds=True)
        return KitchenTicketItemSerializer(qs, many=True).data
