from rest_framework import serializers
from core.models import Coupon, Promotion, Product

class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Coupon
        fields = ['id', 'code', 'discount_type', 'discount_value', 'is_active', 'created_at']

    def validate_code(self, value):
        # Always store and compare coupon codes in uppercase
        return value.upper()

    def validate_discount_value(self, value):
        if value <= 0:
            raise serializers.ValidationError("Discount value must be greater than 0.")
        return value


class CouponValidateSerializer(serializers.Serializer):
    """Used only for the validate endpoint — accepts a coupon code."""
    code = serializers.CharField(write_only=True)


class ProductMiniSerializer(serializers.ModelSerializer):
    """Minimal nested product for PromotionSerializer read output."""
    class Meta:
        model  = Product
        fields = ['id', 'name']


class PromotionSerializer(serializers.ModelSerializer):
    product    = ProductMiniSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model  = Promotion
        fields = [
            'id', 'name', 'promo_type', 'product', 'product_id',
            'min_quantity', 'min_order_amount', 'discount_type',
            'discount_value', 'is_active', 'created_at'
        ]

    def validate(self, data):
        promo_type       = data.get('promo_type')
        product          = data.get('product')
        min_quantity     = data.get('min_quantity')
        min_order_amount = data.get('min_order_amount')

        if promo_type == 'product':
            if not product:
                raise serializers.ValidationError(
                    {'product_id': 'A product is required for product-level promotions.'}
                )
            if not min_quantity:
                raise serializers.ValidationError(
                    {'min_quantity': 'Minimum quantity is required for product-level promotions.'}
                )
        elif promo_type == 'order':
            if not min_order_amount:
                raise serializers.ValidationError(
                    {'min_order_amount': 'Minimum order amount is required for order-level promotions.'}
                )
        return data
