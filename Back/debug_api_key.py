#!/usr/bin/env python3

"""
Debug API Key Storage
This script helps us debug what's actually stored in the database for LLM configurations.
"""

import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.database import get_async_session
from app.models.llm_config import LLMConfiguration, LLMProvider
from sqlalchemy import select

async def debug_llm_configurations():
    """Check what LLM configurations exist and their API key status."""
    
    print("🔍 AI Dock - LLM Configuration Debug")
    print("=" * 50)
    
    session = await get_async_session()
    
    try:
        # Get all LLM configurations
        result = await session.execute(select(LLMConfiguration))
        configs = result.scalars().all()
        
        if not configs:
            print("❌ No LLM configurations found in database!")
            print("\nThis means you need to create an LLM configuration first.")
            print("You can do this through the admin interface or by running a setup script.")
            return
        
        print(f"📊 Found {len(configs)} LLM configuration(s):")
        print()
        
        for config in configs:
            print(f"🔧 Configuration: {config.name}")
            print(f"   ID: {config.id}")
            print(f"   Provider: {config.provider.value}")
            print(f"   Active: {config.is_active}")
            print(f"   API Endpoint: {config.api_endpoint}")
            print(f"   Default Model: {config.default_model}")
            
            # Check API key status
            if config.api_key_encrypted:
                # Get the stored "encrypted" key
                stored_key = config.api_key_encrypted
                print(f"   API Key Status: ✅ Present")
                print(f"   API Key Length: {len(stored_key)} characters")
                print(f"   API Key Preview: {stored_key[:10]}...{stored_key[-4:] if len(stored_key) > 14 else ''}")
                
                # Try to get the "decrypted" key
                try:
                    decrypted_key = config.get_decrypted_api_key()
                    print(f"   Decrypted Key Length: {len(decrypted_key)} characters")
                    print(f"   Decrypted Key Preview: {decrypted_key[:10]}...{decrypted_key[-4:] if len(decrypted_key) > 14 else ''}")
                    
                    # Check if it looks like a valid OpenAI key
                    if config.provider == LLMProvider.OPENAI:
                        if decrypted_key.startswith('sk-'):
                            print(f"   OpenAI Key Format: ✅ Valid (starts with 'sk-')")
                        else:
                            print(f"   OpenAI Key Format: ❌ Invalid (should start with 'sk-')")
                            
                except Exception as e:
                    print(f"   Decryption Error: ❌ {str(e)}")
            else:
                print(f"   API Key Status: ❌ Missing")
            
            print(f"   Last Tested: {config.last_tested_at or 'Never'}")
            if config.last_test_result:
                print(f"   Last Test Result: {config.last_test_result[:100]}...")
            
            print()
    
    finally:
        await session.close()

async def test_openai_key_directly():
    """Test the OpenAI key directly to see if the issue is with our storage."""
    
    session = await get_async_session()
    
    try:
        # Get the first OpenAI configuration
        result = await session.execute(
            select(LLMConfiguration).where(LLMConfiguration.provider == LLMProvider.OPENAI)
        )
        config = result.scalar_one_or_none()
        
        if not config:
            print("❌ No OpenAI configuration found")
            return
        
        print("🧪 Testing OpenAI API Key Directly")
        print("=" * 40)
        
        # Get the API key
        api_key = config.get_decrypted_api_key()
        print(f"Using API key: {api_key[:10]}...{api_key[-4:]}")
        
        # Test with a simple HTTP request (like our service does)
        import httpx
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Simple test payload
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "Hello! This is a test."}],
            "max_tokens": 10
        }
        
        print("🚀 Making test request to OpenAI...")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
                print(f"📡 Response Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print("✅ SUCCESS! OpenAI API key is working correctly.")
                    print(f"Model used: {data.get('model')}")
                    print(f"Response: {data['choices'][0]['message']['content'][:50]}...")
                else:
                    print("❌ ERROR! OpenAI API returned an error:")
                    print(f"Status: {response.status_code}")
                    print(f"Response: {response.text}")
                    
                    # Parse error details if possible
                    try:
                        error_data = response.json()
                        if 'error' in error_data:
                            print(f"Error type: {error_data['error'].get('type')}")
                            print(f"Error message: {error_data['error'].get('message')}")
                    except:
                        pass
                        
            except Exception as e:
                print(f"❌ Network error: {str(e)}")
    
    finally:
        await session.close()

async def main():
    """Main debug function."""
    print("🚀 Starting LLM Configuration Debug")
    print()
    
    await debug_llm_configurations()
    print()
    await test_openai_key_directly()
    
    print()
    print("🎯 Next Steps:")
    print("1. If no configurations exist, create one through admin interface")
    print("2. If API key is wrong, update it in the database")
    print("3. If API key format is wrong, check that it starts with 'sk-'")
    print("4. If all looks correct, the issue might be quota limits on your OpenAI account")

if __name__ == "__main__":
    asyncio.run(main())
