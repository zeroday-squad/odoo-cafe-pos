from rest_framework import serializers
from core.models import Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ['id', 'name', 'color']

    def validate_color(self, value):
        if not value.startswith('#') or len(value) != 7:
            raise serializers.ValidationError(
                "Color must be a valid 7-character hex code starting with '#'. Example: #6366f1"
            )
        return value
