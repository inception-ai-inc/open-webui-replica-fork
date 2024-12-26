import logging
import time
from typing import Optional

from open_webui.apps.webui.internal.db import Base, get_db
from open_webui.env import SRC_LOG_LEVELS
from pydantic import BaseModel, ConfigDict
from sqlalchemy import BigInteger, Column, Text, Float, Integer

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["MODELS"])

####################
# Latency DB Schema
####################

class LatencyMetric(Base):
    __tablename__ = "latency_metrics"
    id = Column(Text, primary_key=True)
    chat_id = Column(Text)
    message_id = Column(Text)
    question_time = Column(Float)  # When user asked the question
    response_start_time = Column(Float)  # When first token appeared
    response_end_time = Column(Float)  # When response was complete
    total_tokens = Column(Integer, nullable=True)
    llm_id = Column(Text)
    created_at = Column(BigInteger)
    user_id = Column(Text, nullable=True)
    chat_context = Column(Text, nullable=True)

class LatencyMetricModel(BaseModel):
    id: str
    chat_id: str
    message_id: str
    question_time: float
    response_start_time: float
    response_end_time: float
    total_tokens: Optional[int] = None
    llm_id: str
    created_at: int
    user_id: Optional[str] = None
    chat_context: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

####################
# Forms
####################

class LatencyMetricForm(BaseModel):
    chat_id: str
    message_id: str
    question_time: float
    response_start_time: float
    response_end_time: float
    total_tokens: Optional[int] = None
    llm_id: str
    user_id: Optional[str] = None
    chat_context: Optional[str] = None

class LatencyMetricTable:
    def insert_metric(self, form_data: LatencyMetricForm) -> Optional[LatencyMetricModel]:
        with get_db() as db:
            metric = LatencyMetricModel(
                **{
                    "id": form_data.message_id,  # Using message_id as the primary key
                    **form_data.model_dump(),
                    "created_at": int(time.time()),
                }
            )
            try:
                result = LatencyMetric(**metric.model_dump())
                db.add(result)
                db.commit()
                db.refresh(result)
                if result:
                    return LatencyMetricModel.model_validate(result)
                else:
                    return None
            except Exception as e:
                print(e)
                return None

    def get_all_metrics(self) -> list[LatencyMetricModel]:
        with get_db() as db:
            return [
                LatencyMetricModel.model_validate(metric)
                for metric in db.query(LatencyMetric)
                .order_by(LatencyMetric.created_at.desc())
                .all()
            ]

    def get_metrics_by_chat_id(self, chat_id: str) -> list[LatencyMetricModel]:
        with get_db() as db:
            return [
                LatencyMetricModel.model_validate(metric)
                for metric in db.query(LatencyMetric)
                .filter_by(chat_id=chat_id)
                .order_by(LatencyMetric.created_at.desc())
                .all()
            ]

    def get_metrics_by_model_id(self, llm_id: str) -> list[LatencyMetricModel]:
        with get_db() as db:
            return [
                LatencyMetricModel.model_validate(metric)
                for metric in db.query(LatencyMetric)
                .filter_by(llm_id=llm_id)
                .order_by(LatencyMetric.created_at.desc())
                .all()
            ]

    def delete_all_metrics(self) -> bool:
        with get_db() as db:
            metrics = db.query(LatencyMetric).all()
            if not metrics:
                return False
            for metric in metrics:
                db.delete(metric)
            db.commit()
            return True

LatencyMetrics = LatencyMetricTable() 