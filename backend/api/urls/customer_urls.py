from django.urls import path
from api.views.customer_views import CustomerViewSet

customer_list = CustomerViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
customer_detail = CustomerViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'delete': 'destroy'
})

urlpatterns = [
    path('', customer_list),
    path('<uuid:pk>/', customer_detail),
]
