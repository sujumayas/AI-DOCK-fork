#!/usr/bin/env python3
"""
AI Dock - Cost Field Migration Script
Migrates existing usage logs to properly populate actual_cost field
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.models.usage_log import UsageLog
from sqlalchemy import select, update

async def migrate_cost_fields():
    """
    Migrate existing usage logs to fix cost field assignment.
    
    This script moves costs from estimated_cost to actual_cost for logs
    where actual_cost is None but estimated_cost has a value.
    """
    print("🔄 AI Dock Cost Field Migration")
    print("=" * 50)
    
    async with AsyncSessionLocal() as session:
        try:
            # Find logs where actual_cost is None but estimated_cost has a value
            print("1. Finding logs that need migration...")
            
            stmt = select(UsageLog).where(
                (UsageLog.actual_cost.is_(None)) &
                (UsageLog.estimated_cost.is_not(None)) &
                (UsageLog.estimated_cost > 0)
            )
            
            result = await session.execute(stmt)
            logs_to_migrate = result.scalars().all()
            
            if not logs_to_migrate:
                print("✅ No logs need migration - all cost fields are already correct!")
                return
            
            print(f"📊 Found {len(logs_to_migrate)} logs that need migration")
            
            # Show some examples
            print("\n2. Example logs to migrate:")
            for i, log in enumerate(logs_to_migrate[:5]):
                print(f"   Log {log.id}: estimated_cost=${log.estimated_cost:.4f}, actual_cost={log.actual_cost}")
                if i >= 4:
                    break
            
            if len(logs_to_migrate) > 5:
                print(f"   ... and {len(logs_to_migrate) - 5} more")
            
            # Ask for confirmation
            response = input(f"\n3. Migrate {len(logs_to_migrate)} logs? (y/N): ")
            if response.lower() != 'y':
                print("❌ Migration cancelled by user")
                return
            
            # Perform the migration
            print(f"\n4. Migrating {len(logs_to_migrate)} logs...")
            
            migrated_count = 0
            for log in logs_to_migrate:
                try:
                    # Move estimated_cost to actual_cost, clear estimated_cost
                    log.actual_cost = log.estimated_cost
                    log.estimated_cost = None
                    log.updated_at = datetime.utcnow()
                    
                    migrated_count += 1
                    
                    if migrated_count % 100 == 0:
                        print(f"   Migrated {migrated_count}/{len(logs_to_migrate)} logs...")
                
                except Exception as log_error:
                    print(f"   ⚠️  Error migrating log {log.id}: {str(log_error)}")
            
            # Commit all changes
            await session.commit()
            
            print(f"\n✅ Migration completed successfully!")
            print(f"   Migrated: {migrated_count}/{len(logs_to_migrate)} logs")
            
            # Verify the migration
            print("\n5. Verifying migration...")
            
            # Check for remaining logs with the old pattern
            verify_stmt = select(UsageLog).where(
                (UsageLog.actual_cost.is_(None)) &
                (UsageLog.estimated_cost.is_not(None)) &
                (UsageLog.estimated_cost > 0)
            )
            
            verify_result = await session.execute(verify_stmt)
            remaining_logs = verify_result.scalars().all()
            
            if not remaining_logs:
                print("✅ Verification passed - no logs remaining with old pattern")
            else:
                print(f"⚠️  {len(remaining_logs)} logs still need migration")
            
            # Show stats of migrated logs
            stats_stmt = select(UsageLog).where(UsageLog.actual_cost.is_not(None))
            stats_result = await session.execute(stats_stmt)
            logs_with_actual_cost = len(stats_result.scalars().all())
            
            print(f"\n📊 Final statistics:")
            print(f"   Total logs with actual_cost: {logs_with_actual_cost}")
            print(f"   Logs migrated in this run: {migrated_count}")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {str(e)}")
            import traceback
            print(traceback.format_exc())
            raise

async def check_migration_status():
    """Check the current status of cost field migration."""
    print("📊 AI Dock Cost Field Status Check")
    print("=" * 50)
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total logs
            total_stmt = select(UsageLog)
            total_result = await session.execute(total_stmt)
            total_logs = len(total_result.scalars().all())
            
            # Count logs with actual_cost
            actual_cost_stmt = select(UsageLog).where(UsageLog.actual_cost.is_not(None))
            actual_cost_result = await session.execute(actual_cost_stmt)
            logs_with_actual_cost = len(actual_cost_result.scalars().all())
            
            # Count logs with estimated_cost
            estimated_cost_stmt = select(UsageLog).where(UsageLog.estimated_cost.is_not(None))
            estimated_cost_result = await session.execute(estimated_cost_stmt)
            logs_with_estimated_cost = len(estimated_cost_result.scalars().all())
            
            # Count logs that need migration
            migration_needed_stmt = select(UsageLog).where(
                (UsageLog.actual_cost.is_(None)) &
                (UsageLog.estimated_cost.is_not(None)) &
                (UsageLog.estimated_cost > 0)
            )
            migration_needed_result = await session.execute(migration_needed_stmt)
            logs_needing_migration = len(migration_needed_result.scalars().all())
            
            print(f"Total usage logs: {total_logs}")
            print(f"Logs with actual_cost: {logs_with_actual_cost}")
            print(f"Logs with estimated_cost: {logs_with_estimated_cost}")
            print(f"Logs needing migration: {logs_needing_migration}")
            
            if logs_needing_migration == 0:
                print("\n✅ All logs are properly migrated!")
            else:
                print(f"\n⚠️  {logs_needing_migration} logs need migration")
                print("Run with --migrate to fix them")
            
            # Calculate percentage
            if total_logs > 0:
                actual_cost_percentage = (logs_with_actual_cost / total_logs) * 100
                print(f"\nCost tracking coverage: {actual_cost_percentage:.1f}%")
            
        except Exception as e:
            print(f"❌ Status check failed: {str(e)}")
            import traceback
            print(traceback.format_exc())

if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(level=logging.WARNING)  # Reduce noise
    
    # Check command line arguments
    if len(sys.argv) > 1 and sys.argv[1] == "--migrate":
        # Run migration
        try:
            asyncio.run(migrate_cost_fields())
        except KeyboardInterrupt:
            print("\n⏹️  Migration interrupted by user")
        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            sys.exit(1)
    else:
        # Just check status
        try:
            asyncio.run(check_migration_status())
            print("\nTo migrate logs, run: python migrate_cost_fields.py --migrate")
        except KeyboardInterrupt:
            print("\n⏹️  Status check interrupted by user")
        except Exception as e:
            print(f"\n❌ Status check failed: {str(e)}")
            sys.exit(1)
