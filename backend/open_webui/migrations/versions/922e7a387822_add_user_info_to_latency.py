"""Add user info and chat context to latency metrics table

Revision ID: 922e7a387822
Revises: 922e7a387821
Create Date: 2024-12-23 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from open_webui.migrations.util import get_existing_tables

# revision identifiers, used by Alembic.
revision: str = "922e7a387822"
down_revision: Union[str, None] = "922e7a387821"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if columns already exist before adding them
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("latency_metrics")]

    if "user_id" not in columns:
        op.add_column("latency_metrics", sa.Column("user_id", sa.Text(), nullable=True))
    if "chat_context" not in columns:
        op.add_column("latency_metrics", sa.Column("chat_context", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("latency_metrics", "user_id")
    op.drop_column("latency_metrics", "chat_context") 