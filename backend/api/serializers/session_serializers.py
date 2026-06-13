from rest_framework import serializers
from core.models import POSSession

class POSSessionSerializer(serializers.ModelSerializer):
    opened_by = serializers.CharField(source='opened_by.name', read_only=True)

    class Meta:
        model = POSSession
        fields = ['id', 'opened_by', 'opened_at', 'closed_at', 'status', 'closing_amount']
        read_only_fields = ['id', 'opened_at', 'closed_at', 'status']


class SessionCloseSummarySerializer(serializers.Serializer):
    closing_amount = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_closing_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Closing amount must be greater than 0.")
        return value
