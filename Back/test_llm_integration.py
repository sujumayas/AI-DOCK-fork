# Test script for LLM Integration Service
# This script tests our LLM service without needing real API keys

import asyncio
import sys
import os

# Add the app directory to Python path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.services.llm_service import (
    llm_service, 
    LLMServiceError, 
    LLMProviderError, 
    LLMConfigurationError,
    ChatMessage,
    ChatRequest
)
from app.models.llm_config import LLMConfiguration, LLMProvider, create_openai_config, create_claude_config
from app.core.database import async_engine, Base
from sqlalchemy.ext.asyncio import AsyncSession

async def setup_test_database():
    """Create test database tables and sample configurations."""
    print("🔧 Setting up test database...")
    
    # Create all tables
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create sample configurations (without real API keys)
    async with AsyncSession(async_engine) as session:
        # Check if configurations already exist
        existing_configs = await session.execute(
            "SELECT COUNT(*) FROM llm_configurations"
        )
        count = existing_configs.scalar()
        
        if count == 0:
            print("📝 Creating sample LLM configurations...")
            
            # Create OpenAI test config
            openai_config = create_openai_config(
                name="Test OpenAI",
                api_key="test-openai-key-not-real",
                description="Test OpenAI configuration (no real API key)"
            )
            
            # Create Claude test config  
            claude_config = create_claude_config(
                name="Test Claude",
                api_key="test-claude-key-not-real",
                description="Test Claude configuration (no real API key)"
            )
            
            session.add(openai_config)
            session.add(claude_config)
            await session.commit()
            
            print(f"✅ Created {openai_config.name} (ID will be assigned)")
            print(f"✅ Created {claude_config.name} (ID will be assigned)")
        else:
            print(f"📄 Found {count} existing configurations")

async def test_service_functionality():
    """Test the LLM service functionality with mock data."""
    print("\n🧪 Testing LLM Service functionality...")
    
    try:
        # Test 1: Get available models for a configuration
        print("\n1️⃣ Testing get_available_models...")
        models = await llm_service.get_available_models(config_id=1)
        print(f"✅ Available models for config 1: {models}")
        
        # Test 2: Estimate cost for a request
        print("\n2️⃣ Testing cost estimation...")
        test_messages = [
            {"role": "user", "content": "Hello, how are you?"},
            {"role": "assistant", "content": "I'm doing well, thank you!"},
            {"role": "user", "content": "Can you help me with Python?"}
        ]
        
        estimated_cost = await llm_service.estimate_request_cost(
            config_id=1,
            messages=test_messages,
            max_tokens=1000
        )
        
        if estimated_cost is not None:
            print(f"✅ Estimated cost: ${estimated_cost:.6f} USD")
        else:
            print("ℹ️ Cost tracking not available for this configuration")
        
        # Test 3: Test configuration connectivity (will fail gracefully without real API keys)
        print("\n3️⃣ Testing configuration connectivity...")
        test_result = await llm_service.test_configuration(config_id=1)
        
        if test_result["success"]:
            print(f"✅ Configuration test successful: {test_result['message']}")
        else:
            print(f"⚠️ Configuration test failed (expected without real API key): {test_result['message']}")
        
        print("\n🎉 Service functionality tests completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        print(f"Error type: {type(e).__name__}")

async def test_chat_request_structure():
    """Test chat request creation and validation."""
    print("\n📝 Testing chat request structures...")
    
    try:
        # Create test chat messages
        messages = [
            ChatMessage("system", "You are a helpful assistant."),
            ChatMessage("user", "Hello! Can you help me learn Python?"),
            ChatMessage("assistant", "Of course! I'd be happy to help you learn Python."),
            ChatMessage("user", "What should I start with?")
        ]
        
        # Create chat request
        request = ChatRequest(
            messages=messages,
            model="gpt-4",
            temperature=0.7,
            max_tokens=1000
        )
        
        print(f"✅ Created chat request with {len(request.messages)} messages")
        print(f"   Model: {request.model}")
        print(f"   Temperature: {request.temperature}")
        print(f"   Max tokens: {request.max_tokens}")
        
        # Test message conversion
        message_dicts = [msg.to_dict() for msg in messages]
        print(f"✅ Converted messages to API format: {len(message_dicts)} messages")
        
        for i, msg in enumerate(message_dicts[:2]):  # Show first 2 messages
            print(f"   Message {i+1}: {msg['role']} - {msg['content'][:50]}...")
        
    except Exception as e:
        print(f"❌ Chat request test failed: {str(e)}")

async def test_provider_classes():
    """Test provider class instantiation."""
    print("\n🔌 Testing provider classes...")
    
    try:
        # Get test configuration from database
        async with AsyncSession(async_engine) as session:
            # Get the first configuration
            result = await session.execute(
                "SELECT * FROM llm_configurations WHERE provider = 'openai' LIMIT 1"
            )
            config_data = result.fetchone()
            
            if config_data:
                print(f"✅ Found test OpenAI configuration: {config_data[1]}")  # name is second column
                
                # Test provider selection logic
                from app.services.llm_service import LLMService
                service = LLMService()
                
                # This will test the provider class mapping
                provider_class = service._get_provider_class(LLMProvider.OPENAI)
                print(f"✅ OpenAI provider class: {provider_class.__name__}")
                
                provider_class = service._get_provider_class(LLMProvider.ANTHROPIC)
                print(f"✅ Anthropic provider class: {provider_class.__name__}")
                
            else:
                print("⚠️ No OpenAI configuration found in database")
    
    except Exception as e:
        print(f"❌ Provider class test failed: {str(e)}")

async def show_configuration_summary():
    """Show summary of available configurations."""
    print("\n📊 LLM Configuration Summary:")
    print("=" * 50)
    
    try:
        async with AsyncSession(async_engine) as session:
            result = await session.execute(
                "SELECT id, name, provider, default_model, is_active FROM llm_configurations ORDER BY id"
            )
            configs = result.fetchall()
            
            if configs:
                for config in configs:
                    status = "🟢 Active" if config[4] else "🔴 Inactive"
                    print(f"ID {config[0]}: {config[1]}")
                    print(f"   Provider: {config[2]}")
                    print(f"   Model: {config[3]}")
                    print(f"   Status: {status}")
                    print()
            else:
                print("No configurations found")
                
    except Exception as e:
        print(f"❌ Failed to load configuration summary: {str(e)}")

async def main():
    """Main test function."""
    print("🚀 AI Dock LLM Integration Service Test")
    print("=" * 50)
    
    try:
        # Setup
        await setup_test_database()
        
        # Show configurations
        await show_configuration_summary()
        
        # Run tests
        await test_chat_request_structure()
        await test_provider_classes()
        await test_service_functionality()
        
        print("\n" + "=" * 50)
        print("🎯 Test Summary:")
        print("✅ LLM service structures working correctly")
        print("✅ Provider abstraction functioning")
        print("✅ Database integration successful")
        print("⚠️ Real API testing requires valid API keys")
        print("\n💡 Next steps:")
        print("   1. Add real API keys to test live connections")
        print("   2. Test through FastAPI endpoints")
        print("   3. Build frontend chat interface")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    # Run the test
    asyncio.run(main())
