from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from api.views.floor_views import FloorViewSet, TableViewSet

floor_list = FloorViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
floor_detail = FloorViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

table_list = TableViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
table_detail = TableViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

@csrf_exempt
def dispatch_list(request, *args, **kwargs):
    if 'floors' in request.path:
        return floor_list(request, *args, **kwargs)
    return table_list(request, *args, **kwargs)

@csrf_exempt
def dispatch_detail(request, *args, **kwargs):
    if 'floors' in request.path:
        return floor_detail(request, *args, **kwargs)
    return table_detail(request, *args, **kwargs)

urlpatterns = [
    path('', dispatch_list),
    path('<uuid:pk>/', dispatch_detail),
]
