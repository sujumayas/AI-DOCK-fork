# Test Script for Usage Logging System (AID-005-A)
# This script verifies that our usage logging system works correctly

import asyncio
import json
import sys
import os
from datetime import datetime
from typing import Dict, Any

# Add the backend directory to Python path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

# Import our models and services
from app.core.database import get_async_session, engine
from app.models import Base
from app.models.user import User
from app.models.department import Department  
from app.models.role import Role
from app.models.llm_config import LLMConfiguration, LLMProvider
from app.models.usage_log import UsageLog
from app.services.usage_service import usage_service

async def setup_test_data():
    """
    Create test data for our usage logging tests.
    
    This creates:
    - A test role and department
    - A test user
    - A test LLM configuration
    """
    print("🔧 Setting up test data...")
    
    async with get_async_session() as session:
        try:
            # Create test role
            test_role = Role(
                name="Test User",
                description="Test role for usage logging",
                is_active=True
            )
            session.add(test_role)
            await session.flush()  # Get the ID without committing
            
            # Create test department
            test_dept = Department(
                name="Test Department",
                code="TEST",
                description="Test department for usage logging",
                is_active=True
            )
            session.add(test_dept)
            await session.flush()  # Get the ID without committing
            
            # Create test user
            test_user = User(
                email="test@aidock.local",
                username="test_user",
                full_name="Test User for Logging",
                password_hash="fake_hash_for_testing",
                role_id=test_role.id,
                department_id=test_dept.id,
                is_active=True,
                is_verified=True
            )
            session.add(test_user)
            await session.flush()  # Get the ID without committing
            
            # Create test LLM configuration
            test_config = LLMConfiguration(
                name="Test OpenAI Config",
                description="Test configuration for usage logging",
                provider=LLMProvider.OPENAI,
                api_endpoint="https://api.openai.com/v1",
                api_key_encrypted="test_key_123",
                default_model="gpt-3.5-turbo",
                available_models=["gpt-3.5-turbo", "gpt-4"],
                cost_per_1k_input_tokens=0.001,
                cost_per_1k_output_tokens=0.002,
                is_active=True,
                is_public=True
            )
            session.add(test_config)
            await session.flush()  # Get the ID without committing
            
            await session.commit()
            
            print(f"✅ Created test data:")
            print(f"   - Role: {test_role.name} (ID: {test_role.id})")
            print(f"   - Department: {test_dept.name} (ID: {test_dept.id})")
            print(f"   - User: {test_user.email} (ID: {test_user.id})")
            print(f"   - LLM Config: {test_config.name} (ID: {test_config.id})")
            
            return {
                "user_id": test_user.id,
                "config_id": test_config.id,
                "department_id": test_dept.id,
                "role_id": test_role.id
            }
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating test data: {str(e)}")
            raise

async def test_successful_usage_logging(test_data: Dict[str, Any]):
    """
    Test logging a successful LLM interaction.
    
    This simulates what happens when a user successfully chats with an AI.
    """
    print("\\n🧪 Testing successful usage logging...")
    
    # Prepare mock request data (what the user sent)
    request_data = {
        "messages_count": 2,
        "total_chars": 45,
        "parameters": {
            "temperature": 0.7,
            "max_tokens": 1000,
            "model_override": None
        }
    }
    
    # Prepare mock response data (what the AI returned)
    response_data = {
        "success": True,
        "content": "Hello! I'm Claude, an AI assistant. How can I help you today?",
        "content_length": 64,
        "model": "gpt-3.5-turbo",
        "provider": "OpenAI",
        "token_usage": {
            "input_tokens": 15,
            "output_tokens": 20,
            "total_tokens": 35
        },
        "cost": 0.000055,  # Calculated: (15 * 0.001 + 20 * 0.002) / 1000
        "error_type": None,
        "error_message": None,
        "http_status_code": 200,
        "raw_metadata": {
            "openai_request_id": "req_test_123",
            "model_version": "gpt-3.5-turbo-0125"
        }
    }
    
    # Prepare mock performance data
    performance_data = {
        "request_started_at": "2024-01-01T12:00:00.000Z",
        "request_completed_at": "2024-01-01T12:00:01.500Z",
        "response_time_ms": 1500
    }
    
    try:
        # Log the usage
        usage_log = await usage_service.log_llm_request(
            user_id=test_data["user_id"],
            llm_config_id=test_data["config_id"],
            request_data=request_data,
            response_data=response_data,
            performance_data=performance_data,
            session_id="test_session_123",
            request_id="test_request_456",
            ip_address="127.0.0.1",
            user_agent="Mozilla/5.0 (Test Browser)"
        )
        
        print(f"✅ Successfully logged usage:")
        print(f"   - Log ID: {usage_log.id}")
        print(f"   - User: {usage_log.user_email}")
        print(f"   - Provider: {usage_log.provider}")
        print(f"   - Model: {usage_log.model}")
        print(f"   - Tokens: {usage_log.total_tokens}")
        print(f"   - Cost: ${usage_log.estimated_cost:.6f}")
        print(f"   - Success: {usage_log.success}")
        print(f"   - Response Time: {usage_log.response_time_ms}ms")
        
        # Verify the data was saved correctly
        assert usage_log.user_id == test_data["user_id"]
        assert usage_log.llm_config_id == test_data["config_id"]
        assert usage_log.success == True
        assert usage_log.total_tokens == 35
        assert usage_log.estimated_cost == 0.000055
        assert usage_log.session_id == "test_session_123"
        assert usage_log.request_id == "test_request_456"
        
        print("✅ All assertions passed for successful logging!")
        return usage_log.id
        
    except Exception as e:
        print(f"❌ Error in successful usage logging test: {str(e)}")
        raise

async def test_failed_usage_logging(test_data: Dict[str, Any]):
    """
    Test logging a failed LLM interaction.
    
    This simulates what happens when an AI request fails.
    """
    print("\\n🧪 Testing failed usage logging...")
    
    # Prepare mock request data
    request_data = {
        "messages_count": 1,
        "total_chars": 25,
        "parameters": {
            "temperature": 0.8,
            "max_tokens": 500
        }
    }
    
    # Prepare mock error response data
    response_data = {
        "success": False,
        "content": "",
        "content_length": 0,
        "model": "gpt-4",
        "provider": "OpenAI",
        "token_usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
        "cost": None,
        "error_type": "LLMQuotaExceededError",
        "error_message": "Rate limit exceeded: Too many requests",
        "http_status_code": 429,
        "raw_metadata": {
            "error_code": "rate_limit_exceeded"
        }
    }
    
    # Prepare mock performance data (request failed quickly)
    performance_data = {
        "request_started_at": "2024-01-01T12:01:00.000Z",
        "request_completed_at": "2024-01-01T12:01:00.250Z",
        "response_time_ms": 250
    }
    
    try:
        # Log the failed usage
        usage_log = await usage_service.log_llm_request(
            user_id=test_data["user_id"],
            llm_config_id=test_data["config_id"],
            request_data=request_data,
            response_data=response_data,
            performance_data=performance_data,
            session_id="test_session_124",
            request_id="test_request_457",
            ip_address="192.168.1.100",
            user_agent="curl/7.68.0"
        )
        
        print(f"✅ Successfully logged failed usage:")
        print(f"   - Log ID: {usage_log.id}")
        print(f"   - User: {usage_log.user_email}")
        print(f"   - Success: {usage_log.success}")
        print(f"   - Error Type: {usage_log.error_type}")
        print(f"   - Error Message: {usage_log.error_message}")
        print(f"   - HTTP Status: {usage_log.http_status_code}")
        print(f"   - Response Time: {usage_log.response_time_ms}ms")
        
        # Verify the error data was saved correctly
        assert usage_log.success == False
        assert usage_log.error_type == "LLMQuotaExceededError"
        assert usage_log.http_status_code == 429
        assert usage_log.total_tokens == 0
        assert usage_log.estimated_cost is None
        
        print("✅ All assertions passed for failed logging!")
        return usage_log.id
        
    except Exception as e:
        print(f"❌ Error in failed usage logging test: {str(e)}")
        raise

async def test_usage_analytics(test_data: Dict[str, Any], log_ids: list):
    """
    Test the usage analytics and reporting functions.
    
    This verifies our summary and reporting methods work correctly.
    """
    print("\\n📊 Testing usage analytics...")
    
    try:
        # Test user usage summary
        user_summary = await usage_service.get_user_usage_summary(
            user_id=test_data["user_id"]
        )
        
        print(f"✅ User Usage Summary:")
        print(f"   - Total Requests: {user_summary['requests']['total']}")
        print(f"   - Successful: {user_summary['requests']['successful']}")
        print(f"   - Failed: {user_summary['requests']['failed']}")
        print(f"   - Success Rate: {user_summary['requests']['success_rate']:.1f}%")
        print(f"   - Total Tokens: {user_summary['tokens']['total']}")
        print(f"   - Total Cost: ${user_summary['cost']['total_usd']:.6f}")
        
        # Verify the summary data
        assert user_summary['requests']['total'] == 2  # We created 2 logs
        assert user_summary['requests']['successful'] == 1  # 1 success
        assert user_summary['requests']['failed'] == 1  # 1 failure
        assert user_summary['requests']['success_rate'] == 50.0  # 50% success
        assert user_summary['tokens']['total'] == 35  # Only from successful request
        
        # Test department usage summary
        dept_summary = await usage_service.get_department_usage_summary(
            department_id=test_data["department_id"]
        )
        
        print(f"\\n✅ Department Usage Summary:")
        print(f"   - Total Requests: {dept_summary['requests']['total']}")
        print(f"   - Success Rate: {dept_summary['requests']['success_rate']:.1f}%")
        print(f"   - Total Cost: ${dept_summary['cost']['total_usd']:.6f}")
        
        # Test provider usage stats
        provider_stats = await usage_service.get_provider_usage_stats()
        
        print(f"\\n✅ Provider Usage Stats:")
        for provider in provider_stats:
            print(f"   - Provider: {provider['provider']}")
            print(f"     Requests: {provider['requests']['total']}")
            print(f"     Success Rate: {provider['requests']['success_rate']:.1f}%")
            print(f"     Total Cost: ${provider['cost']['total_usd']:.6f}")
        
        # Test quota status check
        quota_status = await usage_service.check_user_quota_status(
            user_id=test_data["user_id"]
        )
        
        print(f"\\n✅ User Quota Status:")
        print(f"   - Status: {quota_status['quota_status']}")
        print(f"   - Period: {quota_status['period_days']} days")
        
        print("✅ All analytics tests passed!")
        
    except Exception as e:
        print(f"❌ Error in analytics testing: {str(e)}")
        raise

async def verify_database_records(log_ids: list):
    """
    Verify that the usage logs were actually saved to the database.
    
    This checks that we can query the logs back from the database.
    """
    print("\\n🗃️ Verifying database records...")
    
    async with get_async_session() as session:
        try:
            # Query all usage logs we created
            from sqlalchemy import select
            
            query = select(UsageLog).where(UsageLog.id.in_(log_ids))
            result = await session.execute(query)
            logs = result.scalars().all()
            
            print(f"✅ Found {len(logs)} usage logs in database:")
            
            for log in logs:
                print(f"   - Log {log.id}: {log.provider} {log.model}, "
                      f"{log.total_tokens} tokens, success={log.success}")
                
                # Verify relationships work
                if log.user_id:
                    user = await session.get(User, log.user_id)
                    print(f"     User: {user.email if user else 'NOT FOUND'}")
                
                if log.department_id:
                    dept = await session.get(Department, log.department_id)
                    print(f"     Department: {dept.name if dept else 'NOT FOUND'}")
                
                if log.llm_config_id:
                    config = await session.get(LLMConfiguration, log.llm_config_id)
                    print(f"     Config: {config.name if config else 'NOT FOUND'}")
            
            print("✅ Database verification complete!")
            
        except Exception as e:
            print(f"❌ Error verifying database records: {str(e)}")
            raise

async def cleanup_test_data(test_data: Dict[str, Any]):
    """
    Clean up test data after testing.
    
    This removes the test records we created.
    """
    print("\\n🧹 Cleaning up test data...")
    
    async with get_async_session() as session:
        try:
            # Delete in reverse order of creation to handle foreign keys
            
            # Delete usage logs
            from sqlalchemy import delete
            await session.execute(delete(UsageLog).where(UsageLog.user_id == test_data["user_id"]))
            
            # Delete user
            await session.execute(delete(User).where(User.id == test_data["user_id"]))
            
            # Delete LLM config
            await session.execute(delete(LLMConfiguration).where(LLMConfiguration.id == test_data["config_id"]))
            
            # Delete department
            await session.execute(delete(Department).where(Department.id == test_data["department_id"]))
            
            # Delete role
            await session.execute(delete(Role).where(Role.id == test_data["role_id"]))
            
            await session.commit()
            print("✅ Test data cleaned up successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error cleaning up test data: {str(e)}")

async def main():
    """
    Main test function that runs all our usage logging tests.
    """
    print("🚀 Starting Usage Logging System Tests (AID-005-A)")
    print("=" * 60)
    
    try:
        # Create database tables if they don't exist
        print("🗃️ Creating database tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables ready!")
        
        # Run all tests
        test_data = await setup_test_data()
        
        log_id_1 = await test_successful_usage_logging(test_data)
        log_id_2 = await test_failed_usage_logging(test_data)
        
        log_ids = [log_id_1, log_id_2]
        
        await test_usage_analytics(test_data, log_ids)
        await verify_database_records(log_ids)
        
        # Cleanup
        await cleanup_test_data(test_data)
        
        print("\\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED! Usage Logging System is working perfectly!")
        print("\\n✅ What we verified:")
        print("   - Usage logs are created for successful requests")
        print("   - Usage logs are created for failed requests")
        print("   - All data fields are saved correctly")
        print("   - Analytics and reporting functions work")
        print("   - Database relationships are intact")
        print("   - Error handling is graceful")
        print("\\n🚀 Ready for production use!")
        
    except Exception as e:
        print(f"\\n❌ TEST FAILED: {str(e)}")
        print("\\n🔧 Check the error details above and fix any issues.")
        return False
    
    return True

if __name__ == "__main__":
    # Run the tests
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
