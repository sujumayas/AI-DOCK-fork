#!/usr/bin/env python3
"""
Test script for LLM Configuration models and schemas.

This script tests our new LLM Configuration functionality to ensure
everything works correctly before we build the API endpoints.

Run this script from the Back directory:
    python test_llm_config.py
"""

import asyncio
import sys
import os
from datetime import datetime
from decimal import Decimal

# Add the app directory to Python path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal, engine
from app.models import LLMConfiguration, LLMProvider, User, Role, Department
from app.schemas.llm_config import (
    LLMConfigurationCreate, 
    LLMConfigurationResponse,
    LLMProviderSchema,
    get_provider_info_list
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

async def test_database_connection():
    """Test basic database connectivity."""
    print("🔌 Testing database connection...")
    
    try:
        async with AsyncSessionLocal() as session:
            # Test a simple query
            result = await session.execute(text("SELECT 1"))
            assert result.scalar() == 1
            print("   ✅ Database connection successful!")
            return True
    except Exception as e:
        print(f"   ❌ Database connection failed: {e}")
        return False

async def test_table_creation():
    """Test that our new LLM configuration table can be created."""
    print("\n🏗️  Testing table creation...")
    
    try:
        # Import Base to trigger all model registrations
        from app.core.database import Base
        
        # Create all tables (this should include our new llm_configurations table)
        async with engine.begin() as conn:
            # Drop and recreate tables for clean test
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            
        print("   ✅ All tables created successfully!")
        print("   📋 Tables should include: users, roles, departments, llm_configurations")
        return True
        
    except Exception as e:
        print(f"   ❌ Table creation failed: {e}")
        return False

async def test_llm_provider_enum():
    """Test the LLMProvider enum."""
    print("\n📝 Testing LLMProvider enum...")
    
    try:
        # Test all enum values
        providers = [
            LLMProvider.OPENAI,
            LLMProvider.ANTHROPIC,
            LLMProvider.GOOGLE,
            LLMProvider.MISTRAL,
            LLMProvider.COHERE,
            LLMProvider.HUGGINGFACE,
            LLMProvider.AZURE_OPENAI,
            LLMProvider.CUSTOM
        ]
        
        print(f"   📊 Available providers: {[p.value for p in providers]}")
        
        # Test enum properties
        assert LLMProvider.OPENAI.value == "openai"
        assert LLMProvider.ANTHROPIC.value == "anthropic"
        
        print("   ✅ LLMProvider enum working correctly!")
        return True
        
    except Exception as e:
        print(f"   ❌ LLMProvider enum test failed: {e}")
        return False

async def create_test_dependencies():
    """Create the necessary dependencies (role, department) for testing."""
    print("\n🔗 Creating test dependencies...")
    
    try:
        async with AsyncSessionLocal() as session:
            # Create a test role
            test_role = Role(
                name="Admin",
                description="Administrator role for testing",
                permissions={"can_manage_users": True, "can_view_admin_panel": True}
            )
            session.add(test_role)
            await session.flush()  # Get the ID without committing
            
            # Create a test department
            test_dept = Department(
                name="IT Department",
                code="IT",
                description="Information Technology department for testing"
            )
            session.add(test_dept)
            await session.flush()
            
            # Create a test user
            test_user = User(
                email="testuser@aidock.local",
                username="testuser",
                full_name="Test User",
                password_hash="$2b$12$test_hash_not_real",
                role_id=test_role.id,
                department_id=test_dept.id,
                is_active=True,
                is_verified=True,
                is_admin=True
            )
            session.add(test_user)
            
            await session.commit()
            
            print(f"   ✅ Created test role (ID: {test_role.id})")
            print(f"   ✅ Created test department (ID: {test_dept.id})")
            print(f"   ✅ Created test user (ID: {test_user.id})")
            
            return test_role.id, test_dept.id, test_user.id
            
    except Exception as e:
        print(f"   ❌ Failed to create test dependencies: {e}")
        return None, None, None

async def test_llm_configuration_creation():
    """Test creating LLM configuration records."""
    print("\n🤖 Testing LLM Configuration creation...")
    
    try:
        async with AsyncSessionLocal() as session:
            # Test 1: Create OpenAI configuration
            openai_config = LLMConfiguration(
                name="OpenAI GPT-4 Test",
                description="Test OpenAI configuration",
                provider=LLMProvider.OPENAI,
                api_endpoint="https://api.openai.com/v1",
                api_key_encrypted="test_openai_key_encrypted",
                api_version="2023-05-15",
                default_model="gpt-4",
                available_models=["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"],
                model_config={
                    "temperature": 0.7,
                    "max_tokens": 4000,
                    "top_p": 1.0
                },
                rate_limit_rpm=3000,
                rate_limit_tpm=90000,
                daily_quota=10000,
                monthly_budget_usd=Decimal("1000.00"),
                cost_per_1k_input_tokens=Decimal("0.030000"),
                cost_per_1k_output_tokens=Decimal("0.060000"),
                is_active=True,
                is_public=True,
                priority=10
            )
            
            session.add(openai_config)
            await session.flush()
            
            print(f"   ✅ Created OpenAI config (ID: {openai_config.id})")
            
            # Test 2: Create Claude configuration
            claude_config = LLMConfiguration(
                name="Anthropic Claude Test",
                description="Test Claude configuration",
                provider=LLMProvider.ANTHROPIC,
                api_endpoint="https://api.anthropic.com",
                api_key_encrypted="test_claude_key_encrypted",
                api_version="2023-06-01",
                default_model="claude-3-opus-20240229",
                available_models=[
                    "claude-3-opus-20240229",
                    "claude-3-sonnet-20240229", 
                    "claude-3-haiku-20240307"
                ],
                model_config={
                    "max_tokens": 4000,
                    "temperature": 0.7
                },
                rate_limit_rpm=1000,
                rate_limit_tpm=80000,
                cost_per_1k_input_tokens=Decimal("0.015000"),
                cost_per_1k_output_tokens=Decimal("0.075000"),
                is_active=True,
                is_public=True,
                priority=20
            )
            
            session.add(claude_config)
            await session.flush()
            
            print(f"   ✅ Created Claude config (ID: {claude_config.id})")
            
            await session.commit()
            
            return openai_config.id, claude_config.id
            
    except Exception as e:
        print(f"   ❌ LLM Configuration creation failed: {e}")
        return None, None

async def test_llm_configuration_properties():
    """Test LLM configuration computed properties and methods."""
    print("\n🔍 Testing LLM Configuration properties...")
    
    try:
        async with AsyncSessionLocal() as session:
            # Get the first configuration
            config = await session.get(LLMConfiguration, 1)
            
            if not config:
                print("   ⚠️  No LLM configuration found to test")
                return False
            
            print(f"   📋 Testing config: {config.name}")
            
            # Test provider_name property
            provider_name = config.provider_name
            print(f"   🏷️  Provider name: {provider_name}")
            assert provider_name in ["OpenAI", "Anthropic (Claude)", "Google (Gemini)", "Mistral AI", "Cohere", "Hugging Face", "Azure OpenAI", "Custom Provider"]
            
            # Test is_rate_limited property
            is_rate_limited = config.is_rate_limited
            print(f"   ⏱️  Is rate limited: {is_rate_limited}")
            
            # Test has_cost_tracking property
            has_cost_tracking = config.has_cost_tracking
            print(f"   💰 Has cost tracking: {has_cost_tracking}")
            
            # Test estimated_cost_per_request property
            estimated_cost = config.estimated_cost_per_request
            if estimated_cost:
                print(f"   💵 Estimated cost per request: ${estimated_cost:.6f}")
            
            # Test get_model_list method
            models = config.get_model_list()
            print(f"   🎯 Available models: {models}")
            
            # Test validate_model method
            if models:
                is_valid = config.validate_model(models[0])
                print(f"   ✅ Model '{models[0]}' is valid: {is_valid}")
                
                is_invalid = config.validate_model("nonexistent-model")
                print(f"   ❌ Model 'nonexistent-model' is valid: {is_invalid}")
            
            # Test cost calculation
            if config.has_cost_tracking:
                cost = config.calculate_request_cost(1000, 500)  # 1K input, 500 output tokens
                print(f"   💲 Cost for 1K input + 500 output tokens: ${cost:.6f}")
            
            print("   ✅ All property tests passed!")
            return True
            
    except Exception as e:
        print(f"   ❌ Property tests failed: {e}")
        return False

async def test_llm_configuration_methods():
    """Test LLM configuration business logic methods."""
    print("\n⚙️  Testing LLM Configuration methods...")
    
    try:
        async with AsyncSessionLocal() as session:
            config = await session.get(LLMConfiguration, 1)
            
            if not config:
                print("   ⚠️  No LLM configuration found to test")
                return False
            
            # Test API key encryption/decryption (placeholder)
            print("   🔐 Testing API key handling...")
            original_key = "test-api-key-12345"
            config.set_encrypted_api_key(original_key)
            decrypted_key = config.get_decrypted_api_key()
            # Note: In our placeholder implementation, these are the same
            assert decrypted_key == original_key
            print("   ✅ API key encryption/decryption working (placeholder)")
            
            # Test get_api_headers method
            print("   📨 Testing API headers generation...")
            headers = config.get_api_headers()
            print(f"   📋 Generated headers: {list(headers.keys())}")
            assert "Content-Type" in headers
            assert "Authorization" in headers
            print("   ✅ API headers generated correctly")
            
            # Test connection test (placeholder)
            print("   🔗 Testing connection test...")
            test_result = config.test_connection()
            print(f"   📊 Test result: {test_result['message']}")
            assert test_result["success"] == True
            print("   ✅ Connection test working (placeholder)")
            
            # Test status management
            print("   🎚️  Testing status management...")
            config.deactivate()
            assert config.is_active == False
            config.activate()
            assert config.is_active == True
            
            config.make_private()
            assert config.is_public == False
            config.make_public()
            assert config.is_public == True
            print("   ✅ Status management working correctly")
            
            await session.commit()
            
            print("   ✅ All method tests passed!")
            return True
            
    except Exception as e:
        print(f"   ❌ Method tests failed: {e}")
        return False

async def test_pydantic_schemas():
    """Test Pydantic schema validation."""
    print("\n📋 Testing Pydantic schemas...")
    
    try:
        # Test LLMConfigurationCreate schema
        print("   🆕 Testing LLMConfigurationCreate schema...")
        
        create_data = {
            "name": "Test Schema Config",
            "description": "Testing Pydantic validation",
            "provider": "openai",
            "api_endpoint": "https://api.openai.com/v1",
            "api_key": "sk-test1234567890abcdef",
            "api_version": "2023-05-15",
            "default_model": "gpt-4",
            "available_models": ["gpt-3.5-turbo", "gpt-4"],
            "model_config": {"temperature": 0.7},
            "rate_limit_rpm": 1000,
            "cost_per_1k_input_tokens": 0.03,
            "is_active": True,
            "is_public": True,
            "priority": 50
        }
        
        create_schema = LLMConfigurationCreate(**create_data)
        print(f"   ✅ Created schema: {create_schema.name}")
        
        # Test validation
        assert create_schema.provider == LLMProviderSchema.OPENAI
        assert len(create_schema.api_key) >= 10
        assert create_schema.default_model in create_schema.available_models
        
        # Test LLMConfigurationResponse schema
        print("   📤 Testing LLMConfigurationResponse schema...")
        
        response_data = {
            "id": 1,
            "name": "Test Response Config",
            "provider": "anthropic",
            "provider_name": "Anthropic (Claude)",
            "api_endpoint": "https://api.anthropic.com",
            "default_model": "claude-3-opus",
            "is_active": True,
            "is_public": True,
            "priority": 10,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_rate_limited": True,
            "has_cost_tracking": True
        }
        
        response_schema = LLMConfigurationResponse(**response_data)
        print(f"   ✅ Created response schema: {response_schema.name}")
        
        # Test provider info helper
        print("   📊 Testing provider info helper...")
        provider_list = get_provider_info_list()
        print(f"   📋 Found {len(provider_list)} providers")
        
        for provider in provider_list[:3]:  # Show first 3
            print(f"      - {provider.name}: {provider.description}")
        
        assert len(provider_list) >= 7  # We should have at least 7 providers
        
        print("   ✅ All schema tests passed!")
        return True
        
    except Exception as e:
        print(f"   ❌ Schema tests failed: {e}")
        return False

async def test_helper_functions():
    """Test model helper functions."""
    print("\n🛠️  Testing helper functions...")
    
    try:
        # Test create_openai_config helper
        print("   🤖 Testing create_openai_config helper...")
        from app.models.llm_config import create_openai_config
        openai_config = create_openai_config(
            name="Helper Test OpenAI",
            api_key="sk-test-helper-key"
        )
        
        assert openai_config.provider == LLMProvider.OPENAI
        assert openai_config.name == "Helper Test OpenAI"
        assert openai_config.default_model == "gpt-4"
        print("   ✅ OpenAI helper function working")
        
        # Test create_claude_config helper  
        print("   🧠 Testing create_claude_config helper...")
        from app.models.llm_config import create_claude_config
        claude_config = create_claude_config(
            name="Helper Test Claude",
            api_key="sk-ant-test-helper-key"
        )
        
        assert claude_config.provider == LLMProvider.ANTHROPIC
        assert claude_config.name == "Helper Test Claude"
        assert "claude" in claude_config.default_model.lower()
        print("   ✅ Claude helper function working")
        
        # Test get_default_configs helper
        print("   📦 Testing get_default_configs helper...")
        from app.models.llm_config import get_default_configs
        default_configs = get_default_configs()
        
        assert len(default_configs) >= 2  # Should have OpenAI and Claude
        provider_types = [config.provider for config in default_configs]
        assert LLMProvider.OPENAI in provider_types
        assert LLMProvider.ANTHROPIC in provider_types
        print(f"   ✅ Default configs helper working ({len(default_configs)} configs)")
        
        print("   ✅ All helper function tests passed!")
        return True
        
    except Exception as e:
        print(f"   ❌ Helper function tests failed: {e}")
        return False

async def test_query_and_relationships():
    """Test querying LLM configurations and any relationships."""
    print("\n🔍 Testing queries and relationships...")
    
    try:
        async with AsyncSessionLocal() as session:
            # Test basic query
            print("   📋 Testing basic queries...")
            
            # Get all configurations
            from sqlalchemy import select
            result = await session.execute(select(LLMConfiguration))
            configs = result.scalars().all()
            
            print(f"   📊 Found {len(configs)} LLM configurations")
            
            if configs:
                for config in configs:
                    print(f"      - {config.name} ({config.provider.value}) - Active: {config.is_active}")
            
            # Test filtering
            print("   🔎 Testing filtered queries...")
            result = await session.execute(
                select(LLMConfiguration).where(LLMConfiguration.is_active == True)
            )
            active_configs = result.scalars().all()
            print(f"   ✅ Found {len(active_configs)} active configurations")
            
            # Test ordering
            result = await session.execute(
                select(LLMConfiguration).order_by(LLMConfiguration.priority)
            )
            ordered_configs = result.scalars().all()
            if ordered_configs:
                print(f"   📈 Configs by priority: {[f'{c.name} (p:{c.priority})' for c in ordered_configs]}")
            
            print("   ✅ All query tests passed!")
            return True
            
    except Exception as e:
        print(f"   ❌ Query tests failed: {e}")
        return False

async def run_all_tests():
    """Run all LLM configuration tests."""
    print("🧪 Starting LLM Configuration Tests")
    print("=" * 50)
    
    test_results = []
    
    # Run all tests
    tests = [
        ("Database Connection", test_database_connection),
        ("Table Creation", test_table_creation),
        ("LLM Provider Enum", test_llm_provider_enum),
        ("Test Dependencies", create_test_dependencies),
        ("LLM Config Creation", test_llm_configuration_creation),
        ("Config Properties", test_llm_configuration_properties),
        ("Config Methods", test_llm_configuration_methods),
        ("Pydantic Schemas", test_pydantic_schemas),
        ("Helper Functions", test_helper_functions),
        ("Queries & Relationships", test_query_and_relationships),
    ]
    
    for test_name, test_func in tests:
        try:
            result = await test_func()
            test_results.append((test_name, result))
        except Exception as e:
            print(f"   💥 {test_name} crashed: {e}")
            test_results.append((test_name, False))
    
    # Print summary
    print("\n" + "=" * 50)
    print("🎯 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, result in test_results if result)
    failed = len(test_results) - passed
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n📊 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! LLM Configuration is ready!")
        return True
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
        return False

if __name__ == "__main__":
    # Run the tests
    success = asyncio.run(run_all_tests())
    
    if success:
        print("\n🚀 Ready to proceed with API endpoint development!")
        sys.exit(0)
    else:
        print("\n🔧 Please fix the failing tests before continuing.")
        sys.exit(1)
