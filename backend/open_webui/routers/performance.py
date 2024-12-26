from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel

from open_webui.apps.webui.models.users import Users, UserModel
from open_webui.apps.webui.models.latency import LatencyMetrics, LatencyMetricForm
from open_webui.constants import ERROR_MESSAGES
from open_webui.utils.utils import get_admin_user, get_verified_user

router = APIRouter()

@router.post("/latency")
async def record_latency(
    request: Request,
    metric: LatencyMetricForm,
    user=Depends(get_admin_user),
):
    """Record latency metrics for a chat interaction"""
    try:
        result = LatencyMetrics.insert_metric(metric)
        if result:
            return {"status": "success"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save metric"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/latency")
async def get_latency_metrics(
    request: Request,
    user=Depends(get_admin_user),
):
    """Get all recorded latency metrics"""
    try:
        metrics = LatencyMetrics.get_all_metrics()
        return {"metrics": [metric.model_dump() for metric in metrics]}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) 