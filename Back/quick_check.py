#!/usr/bin/env python3

"""
Quick LLM Configuration Check
This script quickly checks what LLM configurations exist in your database.
"""

import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.database import get_async_session
from app.models.llm_config import LLMConfiguration
from sqlalchemy import select

async def quick_check():
    """Quick check of LLM configurations."""
    
    print("🔍 Quick LLM Configuration Check")
    print("=" * 40)
    
    session = await get_async_session()
    
    try:
        # Get all LLM configurations
        result = await session.execute(select(LLMConfiguration))
        configs = result.scalars().all()
        
        print(f"Found {len(configs)} LLM configuration(s)")
        
        for config in configs:
            print(f"\n📝 Config ID: {config.id}")
            print(f"   Name: {config.name}")
            print(f"   Provider: {config.provider.value}")
            print(f"   Active: {'✅' if config.is_active else '❌'}")
            
            if config.api_key_encrypted:
                key = config.api_key_encrypted
                print(f"   API Key: {key[:8]}...{key[-4:]} ({len(key)} chars)")
                
                # Check if it looks like OpenAI format
                if config.provider.value == 'openai':
                    if key.startswith('sk-'):
                        print(f"   Format: ✅ Valid OpenAI format")
                    else:
                        print(f"   Format: ❌ Should start with 'sk-'")
            else:
                print(f"   API Key: ❌ Missing")
                
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    finally:
        await session.close()

if __name__ == "__main__":
    asyncio.run(quick_check())
