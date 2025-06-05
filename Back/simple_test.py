#!/usr/bin/env python3
"""
Simple test to verify our LLM Configuration models work.
"""

# Test imports
try:
    print("🔄 Testing imports...")
    
    # Test model imports
    from app.models.llm_config import LLMConfiguration, LLMProvider
    print("   ✅ LLM Configuration model imported successfully")
    
    # Test schema imports
    from app.schemas.llm_config import LLMConfigurationCreate, LLMConfigurationResponse
    print("   ✅ LLM Configuration schemas imported successfully")
    
    # Test enum values
    print(f"   📋 Available providers: {[p.value for p in LLMProvider]}")
    
    # Test helper functions
    from app.models.llm_config import create_openai_config, get_default_configs
    print("   ✅ Helper functions imported successfully")
    
    # Test creating a configuration object (without database)
    config = create_openai_config(
        name="Test OpenAI Config",
        api_key="sk-test-key"
    )
    print(f"   ✅ Created config object: {config.name}")
    print(f"   🏷️  Provider: {config.provider_name}")
    print(f"   💰 Has cost tracking: {config.has_cost_tracking}")
    
    # Test schema validation
    schema_data = {
        "name": "Test Schema",
        "provider": "openai",
        "api_endpoint": "https://api.openai.com/v1",
        "api_key": "sk-test-key-12345",
        "default_model": "gpt-4"
    }
    
    schema = LLMConfigurationCreate(**schema_data)
    print(f"   ✅ Schema validation successful: {schema.name}")
    
    print("\n🎉 All basic tests passed! Models and schemas are working correctly.")
    print("💡 You can now run the full test script in your terminal:")
    print("   cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back")
    print("   python test_llm_config.py")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("💡 Make sure you're running from the Back directory with the virtual environment activated")
    
except Exception as e:
    print(f"❌ Test failed: {e}")
    import traceback
    traceback.print_exc()
