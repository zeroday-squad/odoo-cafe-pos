from rest_framework import serializers
from core.models import User

class StaffListSerializer(serializers.ModelSerializer):
    """Used for listing staff. Never returns password."""
    class Meta:
        model  = User
        fields = ['id', 'name', 'email', 'role', 'is_archived', 'created_at']


class StaffCreateSerializer(serializers.ModelSerializer):
    """Used when creating a new staff member."""
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model  = User
        fields = ['id', 'name', 'email', 'password', 'role']

    def create(self, validated_data):
        return User.objects.create_user(
            name=validated_data['name'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data.get('role', 'cashier')
        )


class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=6)

    def validate_new_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Password must be at least 6 characters.")
        return value
