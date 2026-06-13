from rest_framework import serializers
from core.models import Product, Category

class CategoryNestedSerializer(serializers.ModelSerializer):
    """Read-only nested representation used inside ProductSerializer."""
    class Meta:
        model = Category
        fields = ['id', 'name', 'color']


class ProductSerializer(serializers.ModelSerializer):
    category    = CategoryNestedSerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'category', 'category_id',
            'price', 'unit', 'tax', 'description',
            'show_in_kds', 'is_active'
        ]
        read_only_fields = ['id']

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than 0.")
        return value
