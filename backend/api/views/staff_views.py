from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from core.models import User
from core.permissions import IsAdminUser
from api.serializers.staff_serializers import (
    StaffListSerializer, StaffCreateSerializer, ChangePasswordSerializer
)

class StaffViewSet(ModelViewSet):
    queryset           = User.objects.all().order_by('created_at')
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return StaffCreateSerializer
        return StaffListSerializer

    @action(detail=True, methods=['post'], url_path='change-password')
    def change_password(self, request, pk=None):
        user = self.get_object()
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': 'Password updated successfully.'})

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        user = self.get_object()
        user.is_archived = True
        user.save()
        return Response({'message': 'Account archived successfully.'})
