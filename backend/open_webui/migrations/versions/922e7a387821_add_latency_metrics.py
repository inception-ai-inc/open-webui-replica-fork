"""Add latency metrics table

Revision ID: 922e7a387821
Revises: 922e7a387820
Create Date: 2024-12-23 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from open_webui.migrations.util import get_existing_tables

# revision identifiers, used by Alembic.
revision: str = "922e7a387821"
down_revision: Union[str, None] = "922e7a387820"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table exists before creating it
    existing_tables = set(get_existing_tables())
    if "latency_metrics" not in existing_tables:
        op.create_table(
            "latency_metrics",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("chat_id", sa.Text(), nullable=True),
            sa.Column("message_id", sa.Text(), nullable=True),
            sa.Column("question_time", sa.Float(), nullable=True),
            sa.Column("response_start_time", sa.Float(), nullable=True),
            sa.Column("response_end_time", sa.Float(), nullable=True),
            sa.Column("total_tokens", sa.Integer(), nullable=True),
            sa.Column("llm_id", sa.Text(), nullable=True),
            sa.Column("created_at", sa.BigInteger(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    op.drop_table("latency_metrics") 