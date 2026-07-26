"""根 conftest：集成测试落在隔离临时库，不再读写开发库 ./exam.db（issue #140）。

pytest 保证 conftest 先于测试模块 import，故此处赋值早于 database.py 模块级的
os.getenv("DATABASE_URL")；setdefault 保留外部（CI 等）显式指定 DATABASE_URL 的能力。
test_migration.py 每次调用 alembic 时显式覆盖 DATABASE_URL，自管临时库，不受此影响。
临时目录交由操作系统清理，不在测试进程内删除——engine 生命周期与进程一致。
"""
import os
import tempfile

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='shuati-test-')}/test.db",
)
