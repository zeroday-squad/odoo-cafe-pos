from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.models import POSSession, Order
from core.permissions import IsEmployeeOrAdmin
from api.serializers.session_serializers import POSSessionSerializer, SessionCloseSummarySerializer

class CurrentSessionView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def get(self, request):
        session = POSSession.objects.filter(status='open').first()
        if session:
            serializer = POSSessionSerializer(session)
            return Response(serializer.data)
        
        # If no open session, find the last closed session
        last_closed = POSSession.objects.filter(status='closed').order_by('-closed_at').first()
        return Response({
            "status": "none",
            "last_opened": last_closed.opened_at.isoformat() if last_closed else None,
            "last_closing_amount": str(last_closed.closing_amount) if last_closed else None
        })


class OpenSessionView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def post(self, request):
        with transaction.atomic():
            # select_for_update prevents race conditions by locking rows matching status='open'
            if POSSession.objects.select_for_update().filter(status='open').exists():
                return Response({"detail": "A session is already open."}, status=400)
            
            session = POSSession.objects.create(
                opened_by=request.user,
                status='open'
            )
            return Response({
                "session_id": str(session.id),
                "opened_at": session.opened_at.isoformat()
            }, status=201)


class CloseSessionView(APIView):
    permission_classes = [IsEmployeeOrAdmin]

    def post(self, request):
        session = POSSession.objects.filter(status='open').first()
        if not session:
            return Response({"detail": "No active open session found."}, status=400)

        # Only session opener or admin can close the session
        if request.user != session.opened_by and request.user.role != 'admin':
            return Response({"detail": "Only the user who opened the session or an admin can close it."}, status=403)

        serializer = SessionCloseSummarySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session.status = 'closed'
        session.closed_at = timezone.now()
        session.closing_amount = serializer.validated_data['closing_amount']
        session.save()

        # Calculate totals
        orders = session.orders.all()
        total_orders = orders.count()
        total_revenue = orders.filter(status='paid').aggregate(total_sum=Sum('total'))['total_sum'] or 0

        return Response({
            "total_orders": total_orders,
            "total_revenue": str(total_revenue),
            "closing_amount": str(session.closing_amount)
        }, status=200)
