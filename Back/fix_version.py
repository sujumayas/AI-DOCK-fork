#!/usr/bin/env python3

"""
Fix OpenAI API Version Issue
This script removes the problematic OpenAI-Version header.
"""

import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.database import get_async_session
from app.models.llm_config import LLMConfiguration, LLMProvider
from sqlalchemy import select

async def fix_openai_version():
    """Fix the OpenAI API version issue."""
    
    print("🔧 AI Dock - Fix OpenAI Version Header")
    print("=" * 45)
    print()
    print("🎯 Issue: OpenAI-Version header '2023-05-15' is not supported")
    print("💡 Solution: Remove the version header (use default)")
    print()
    
    session = await get_async_session()
    
    try:
        # Find all OpenAI configurations
        result = await session.execute(
            select(LLMConfiguration).where(LLMConfiguration.provider == LLMProvider.OPENAI)
        )
        configs = result.scalars().all()
        
        if not configs:
            print("❌ No OpenAI configurations found!")
            return False
        
        print(f"📊 Found {len(configs)} OpenAI configuration(s)")
        
        for config in configs:
            print(f"\n🔧 Fixing: {config.name}")
            print(f"   Current version: {config.api_version}")
            
            # Remove the problematic version header
            config.api_version = None
            
            print(f"   ✅ Removed version header (will use OpenAI default)")
        
        # Commit changes
        await session.commit()
        
        print(f"\n🎉 Successfully fixed OpenAI version issue!")
        print("   OpenAI will now use the default API version")
        
        return True
        
    except Exception as e:
        print(f"❌ Error fixing version: {str(e)}")
        await session.rollback()
        return False
    
    finally:
        await session.close()

async def test_fixed_connection():
    """Test the OpenAI connection after fixing the version."""
    
    print("\n🧪 Testing Fixed OpenAI Connection")
    print("=" * 35)
    
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
        
        print(f"📋 Testing: {config.name}")
        print(f"   API Version: {config.api_version or 'Default (no header)'}")
        
        # Test with a simple HTTP request
        import httpx
        
        headers = config.get_api_headers()
        print(f"   Headers: {list(headers.keys())}")
        
        payload = {
            "model": config.default_model,
            "messages": [{"role": "user", "content": "Hello! Say 'It works!' if you can read this."}],
            "max_tokens": 20
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
                model_used = data.get('model')
                
                print(f"✅ SUCCESS! OpenAI Chat Working!")
                print(f"   Response: '{response_text.strip()}'")
                print(f"   Model: {model_used}")
                print(f"   Tokens used: {data.get('usage', {})}")
                return True
            else:
                print(f"❌ ERROR! Status {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error', {}).get('message', 'Unknown error')}")
                except:
                    print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Connection test failed: {str(e)}")
        return False
    
    finally:
        await session.close()

async def main():
    """Main function to fix OpenAI version issue."""
    
    # Step 1: Fix the version header
    success = await fix_openai_version()
    
    if not success:
        print("\n❌ Failed to fix version header. Please check the errors above.")
        return
    
    # Step 2: Test the fixed connection
    print("\n" + "=" * 50)
    test_success = await test_fixed_connection()
    
    if test_success:
        print("\n🎉 PERFECT! Your chat interface should work now!")
        print("\n📋 What to do next:")
        print("1. Keep your backend server running")
        print("2. Go to your chat interface: http://localhost:8080/chat")
        print("3. Send a message - it should work immediately!")
        print("4. You should see a real response from OpenAI!")
        
        print("\n🎓 What we learned:")
        print("- API versioning issues are common")
        print("- Always read error messages carefully")
        print("- Sometimes 'omit the header' is the best solution")
        print("- External APIs change their supported versions")
    else:
        print("\n⚠️  Version header fixed but connection still failing.")
        print("   Please check your OpenAI account status.")
        print("   The API key is working, so this might be a different issue.")

if __name__ == "__main__":
    asyncio.run(main())
