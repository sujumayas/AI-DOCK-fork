#!/usr/bin/env python3

"""
Fix OpenAI API Key Configuration
This script properly updates the OpenAI API key in your database.
"""

import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.database import get_async_session
from app.models.llm_config import LLMConfiguration, LLMProvider
from sqlalchemy import select

async def fix_openai_api_key():
    """Fix the OpenAI API key configuration."""
    
    print("🔧 AI Dock - Fix OpenAI API Key")
    print("=" * 40)
    
    # Get the new API key from user
    print("\n📝 Enter your OpenAI API key:")
    print("   - Should start with 'sk-'")
    print("   - Get it from https://platform.openai.com/api-keys")
    print("   - Make sure your account has billing enabled")
    
    api_key = input("\n🔑 API Key: ").strip()
    
    if not api_key:
        print("❌ No API key provided. Exiting.")
        return False
    
    if not api_key.startswith('sk-'):
        print("❌ Invalid API key format. OpenAI keys should start with 'sk-'")
        return False
    
    print(f"✅ Valid format detected: {api_key[:10]}...{api_key[-4:]}")
    
    session = await get_async_session()
    
    try:
        # Find existing OpenAI configurations
        result = await session.execute(
            select(LLMConfiguration).where(LLMConfiguration.provider == LLMProvider.OPENAI)
        )
        configs = result.scalars().all()
        
        if not configs:
            print("\n❌ No OpenAI configurations found!")
            print("Creating a new OpenAI configuration...")
            
            # Create new configuration
            config = LLMConfiguration(
                name="OpenAI ChatGPT",
                description="OpenAI GPT models via API",
                provider=LLMProvider.OPENAI,
                api_endpoint="https://api.openai.com/v1",
                default_model="gpt-3.5-turbo",
                available_models=["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"],
                model_parameters={
                    "temperature": 0.7,
                    "max_tokens": 4000
                },
                rate_limit_rpm=3000,
                rate_limit_tpm=90000,
                cost_per_1k_input_tokens=0.0015,  # Updated pricing
                cost_per_1k_output_tokens=0.002,
                is_active=True,
                is_public=True,
                priority=10
            )
            
            # Set the API key using the correct method
            config.set_encrypted_api_key(api_key)
            
            session.add(config)
            print(f"✅ Created new OpenAI configuration")
            
        else:
            print(f"\n📊 Found {len(configs)} OpenAI configuration(s)")
            
            for i, config in enumerate(configs, 1):
                print(f"\n{i}. {config.name}")
                print(f"   ID: {config.id}")
                print(f"   Active: {config.is_active}")
                print(f"   Current API Key: {config.api_key_encrypted[:10] if config.api_key_encrypted else 'None'}...")
                
                # Update the API key using the correct field and method
                config.set_encrypted_api_key(api_key)
                config.is_active = True  # Make sure it's active
                
                print(f"   ✅ Updated API key for '{config.name}'")
        
        # Commit all changes
        await session.commit()
        
        print(f"\n🎉 Successfully updated OpenAI API key!")
        print(f"   Key preview: {api_key[:10]}...{api_key[-4:]}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error updating API key: {str(e)}")
        await session.rollback()
        return False
    
    finally:
        await session.close()

async def test_openai_connection():
    """Test the OpenAI connection after updating the key."""
    
    print("\n🧪 Testing OpenAI Connection")
    print("=" * 30)
    
    session = await get_async_session()
    
    try:
        # Get OpenAI configuration
        result = await session.execute(
            select(LLMConfiguration).where(
                LLMConfiguration.provider == LLMProvider.OPENAI,
                LLMConfiguration.is_active == True
            )
        )
        config = result.scalar_one_or_none()
        
        if not config:
            print("❌ No active OpenAI configuration found")
            return False
        
        print(f"📋 Testing configuration: {config.name}")
        
        # Test with a simple HTTP request
        import httpx
        
        headers = config.get_api_headers()
        
        payload = {
            "model": config.default_model,
            "messages": [{"role": "user", "content": "Hello! This is a test."}],
            "max_tokens": 10
        }
        
        print("🚀 Making test request to OpenAI...")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.api_endpoint}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            print(f"📡 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                response_text = data['choices'][0]['message']['content']
                print(f"✅ SUCCESS! OpenAI responded: '{response_text}'")
                print(f"   Model used: {data.get('model')}")
                return True
            else:
                print(f"❌ ERROR! Status {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Connection test failed: {str(e)}")
        return False
    
    finally:
        await session.close()

async def main():
    """Main function to fix OpenAI API key."""
    
    # Step 1: Fix the API key
    success = await fix_openai_api_key()
    
    if not success:
        print("\n❌ Failed to update API key. Please check the errors above.")
        return
    
    # Step 2: Test the connection
    print("\n" + "=" * 50)
    test_success = await test_openai_connection()
    
    if test_success:
        print("\n🎉 Perfect! Your OpenAI integration is now working!")
        print("\n📋 Next Steps:")
        print("1. Restart your backend server (Ctrl+C, then 'uvicorn app.main:app --reload')")
        print("2. Go to your chat interface at http://localhost:8080/chat")
        print("3. Try sending a message - it should work now!")
    else:
        print("\n⚠️  API key updated but connection test failed.")
        print("   This might be due to:")
        print("   - Billing not enabled on your OpenAI account")
        print("   - Rate limits or quota exceeded")
        print("   - Network connectivity issues")
        print("\n   Check your OpenAI account at https://platform.openai.com/usage")

if __name__ == "__main__":
    asyncio.run(main())
