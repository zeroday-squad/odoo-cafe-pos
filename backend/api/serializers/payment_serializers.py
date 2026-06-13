from rest_framework import serializers
from core.models import PaymentMethod

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PaymentMethod
        fields = ['id', 'method', 'is_enabled', 'upi_id']
        read_only_fields = ['method']

    def validate(self, data):
        method     = data.get('method', getattr(self.instance, 'method', None))
        is_enabled = data.get('is_enabled', getattr(self.instance, 'is_enabled', False))
        upi_id     = data.get('upi_id', getattr(self.instance, 'upi_id', None))
        if method == 'upi' and is_enabled and not upi_id:
            raise serializers.ValidationError(
                {'upi_id': 'UPI ID is required when UPI payment is enabled.'}
            )
        return data
