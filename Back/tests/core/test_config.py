# Test Configuration Script
# This script shows you how your API keys are loaded

import sys
import os

# Add the project root to Python path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.config import settings

def test_api_keys():
    """Test that your API keys are loaded correctly."""
    print("🔑 API Key Configuration Test")
    print("=" * 40)
    
    # Test OpenAI configuration
    print(f"\n📋 OpenAI Configuration:")
    if settings.openai_api_key:
        # Don't show the full key for security
        masked_key = settings.openai_api_key[:7] + "..." + settings.openai_api_key[-4:]
        print(f"   ✅ API Key: {masked_key}")
        print(f"   📝 Length: {len(settings.openai_api_key)} characters")
        
        if settings.openai_api_key.startswith("sk-"):
            print("   ✅ Format: Valid OpenAI key format")
        else:
            print("   ⚠️  Format: Doesn't look like OpenAI key (should start with 'sk-')")
    else:
        print("   ❌ No OpenAI API key found")
        print("   💡 Add OPENAI_API_KEY to your .env file")
    
    # Test Anthropic configuration
    print(f"\n🤖 Anthropic Configuration:")
    if settings.anthropic_api_key:
        masked_key = settings.anthropic_api_key[:10] + "..." + settings.anthropic_api_key[-4:]
        print(f"   ✅ API Key: {masked_key}")
        print(f"   📝 Length: {len(settings.anthropic_api_key)} characters")
        
        if settings.anthropic_api_key.startswith("sk-ant-"):
            print("   ✅ Format: Valid Anthropic key format")
        else:
            print("   ⚠️  Format: Doesn't look like Anthropic key (should start with 'sk-ant-')")
    else:
        print("   ❌ No Anthropic API key found")
        print("   💡 Add ANTHROPIC_API_KEY to your .env file")
    
    # Test other configuration
    print(f"\n⚙️  Other Configuration:")
    print(f"   🔐 Secret Key: {settings.secret_key[:10]}...")
    print(f"   🌍 Environment: {settings.environment}")
    print(f"   🐛 Debug Mode: {settings.debug}")
    print(f"   🗄️  Database: {settings.database_url}")
    print(f"   🌐 Frontend URL: {settings.frontend_url}")
    
    # Check if we have at least one LLM API key
    print(f"\n🎯 API Key Summary:")
    has_openai = bool(settings.openai_api_key and settings.openai_api_key != "sk-your-openai-api-key-here")
    has_anthropic = bool(settings.anthropic_api_key and settings.anthropic_api_key != "sk-ant-your-anthropic-api-key-here")
    
    if has_openai or has_anthropic:
        print("   ✅ You have at least one LLM API key configured!")
        if has_openai:
            print("   🤖 OpenAI: Ready")
        if has_anthropic:
            print("   🧠 Anthropic: Ready")
    else:
        print("   ⚠️  No LLM API keys configured yet")
        print("   💡 Add your API keys to the .env file")
    
    return has_openai or has_anthropic

if __name__ == "__main__":
    print("🔧 Testing your API key configuration...\n")
    
    # Check if .env file exists
    env_file_path = "/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/.env"
    if os.path.exists(env_file_path):
        print(f"✅ Found .env file: {env_file_path}")
    else:
        print(f"❌ No .env file found at: {env_file_path}")
        print("💡 Create a .env file and add your API keys!")
        exit(1)
    
    # Test the configuration
    has_keys = test_api_keys()
    
    if has_keys:
        print("\n🎉 Configuration looks good! Ready to make LLM API calls!")
    else:
        print("\n📝 Next steps:")
        print("   1. Get API keys from OpenAI or Anthropic")
        print("   2. Add them to your .env file")
        print("   3. Run this script again to verify")
