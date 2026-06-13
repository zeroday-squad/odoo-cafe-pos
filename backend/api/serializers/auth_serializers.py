from rest_framework import serializers
from django.contrib.auth import authenticate
from core.models import User

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['name', 'email', 'password']

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        # First user ever becomes admin. All subsequent users default to cashier.
        role = 'admin' if User.objects.count() == 0 else 'cashier'
        return User.objects.create_user(
            name=validated_data['name'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=role
        )


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['email'], password=data['password'])
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if user.is_archived:
            raise serializers.ValidationError("This account has been deactivated.")
        return user
