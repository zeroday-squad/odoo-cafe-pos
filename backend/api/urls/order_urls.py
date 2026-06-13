from django.urls import path
from api.views.order_views import (
    OrderViewSet, OrderItemView, OrderItemDetailView,
    SendKitchenView, PayOrderView, SendReceiptView
)

order_list = OrderViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
order_detail = OrderViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'delete': 'destroy'
})

urlpatterns = [
    path('', order_list),
    path('<uuid:pk>/', order_detail),
    path('<uuid:pk>/items/', OrderItemView.as_view()),
    path('<uuid:pk>/items/<uuid:item_id>/', OrderItemDetailView.as_view()),
    path('<uuid:pk>/send-kitchen/', SendKitchenView.as_view()),
    path('<uuid:pk>/pay/', PayOrderView.as_view()),
    path('<uuid:pk>/send-receipt/', SendReceiptView.as_view()),
]
