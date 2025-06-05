#!/usr/bin/env python3
"""
🚑 Quick Fix - LLM Provider Issues
This script helps fix OpenAI quota issues for immediate testing
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_db
from app.models.llm_config import LLMConfiguration, LLMProvider
from sqlalchemy import select

async def update_openai_key():
    """Update OpenAI API key in database"""
    print("🔑 Updating OpenAI configuration...")
    
    # Get new API key
    new_key = input("🔑 Enter your new OpenAI API key (or press Enter to skip): ").strip()
    
    if not new_key:
        print("⏭️ Skipping OpenAI key update")
        return False
    
    if not new_key.startswith("sk-"):
        print("❌ Invalid API key format. Should start with 'sk-'")
        return False
    
    async for db in get_async_db():
        try:
            # Find OpenAI configuration
            result = await db.execute(
                select(LLMConfiguration).where(LLMConfiguration.name == "OpenAI ChatGPT")
            )
            config = result.scalar_one_or_none()
            
            if config:
                config.api_key = new_key
                await db.commit()
                print("✅ OpenAI key updated!")
                return True
            else:
                print("❌ OpenAI configuration not found")
                return False
                
        except Exception as e:
            print(f"❌ Database error: {e}")
            return False
        finally:
            await db.close()
            break

async def create_mock_provider():
    """Create a mock LLM provider for testing"""
    print("🎭 Creating mock LLM provider...")
    
    async for db in get_async_db():
        try:
            # Check if mock provider exists
            result = await db.execute(
                select(LLMConfiguration).where(LLMConfiguration.name == "Mock LLM (Testing)")
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print("ℹ️ Mock provider already exists, updating...")
                config = existing
            else:
                print("➕ Creating new mock provider...")
                config = LLMConfiguration()
            
            # Configure mock provider
            config.name = "Mock LLM (Testing)"
            config.provider = LLMProvider.OPENAI  # Use OpenAI format
            config.provider_name = "Mock"
            config.api_key = "mock-api-key-for-testing"
            config.base_url = "https://httpbin.org/post"  # Mock endpoint
            config.default_model = "mock-gpt-3.5"
            config.available_models = ["mock-gpt-3.5", "mock-gpt-4"]
            config.is_active = True
            config.is_public = True
            config.priority = 0  # Highest priority
            config.max_tokens_per_request = 1000
            config.rate_limit_per_minute = 1000
            config.cost_per_1k_input_tokens = 0.0
            config.cost_per_1k_output_tokens = 0.0
            config.has_cost_tracking = False
            
            config.configuration_params = {
                "temperature": 0.7,
                "max_tokens": 100
            }
            
            if not existing:
                db.add(config)
            
            await db.commit()
            
            print("✅ Mock provider created!")
            print("📝 This provider will return test responses")
            print("🎯 Perfect for testing UI without API costs")
            
            return True
            
        except Exception as e:
            print(f"❌ Error creating mock provider: {e}")
            return False
        finally:
            await db.close()
            break

async def disable_problematic_providers():
    """Disable providers that are causing quota issues"""
    print("🔧 Disabling problematic providers...")
    
    async for db in get_async_db():
        try:
            # Find all OpenAI configurations
            result = await db.execute(
                select(LLMConfiguration).where(LLMConfiguration.provider == LLMProvider.OPENAI)
            )
            configs = result.scalars().all()
            
            for config in configs:
                if "ChatGPT" in config.name:
                    config.is_active = False
                    print(f"⏸️ Disabled: {config.name}")
            
            await db.commit()
            print("✅ Problematic providers disabled")
            
        except Exception as e:
            print(f"❌ Error disabling providers: {e}")
        finally:
            await db.close()
            break

async def show_current_status():
    """Show current LLM provider status"""
    print("\n📊 Current LLM Provider Status:")
    print("-" * 40)
    
    async for db in get_async_db():
        try:
            result = await db.execute(select(LLMConfiguration))
            configs = result.scalars().all()
            
            if not configs:
                print("❌ No LLM providers configured")
                return
            
            for config in configs:
                status = "🟢 Active" if config.is_active else "🔴 Inactive"
                priority = config.priority or 0
                print(f"{status} | {config.name}")
                print(f"    Provider: {config.provider_name}")
                print(f"    Model: {config.default_model}")
                print(f"    Priority: {priority}")
                print(f"    Cost tracking: {'Yes' if config.has_cost_tracking else 'No'}")
                print()
                
        except Exception as e:
            print(f"❌ Error checking status: {e}")
        finally:
            await db.close()
            break

def show_menu():
    """Show options menu"""
    print("\n🛠️ Quick Fix Options:")
    print("1. Update OpenAI API key")
    print("2. Create mock provider for testing")
    print("3. Disable problematic providers")
    print("4. Show current provider status")
    print("5. Exit")
    return input("\n🎯 Choose option (1-5): ").strip()

async def main():
    """Main menu"""
    print("🚑 AI Dock - Quick LLM Fix")
    print("=" * 40)
    print()
    print("🎯 Purpose: Fix OpenAI quota issues for immediate testing")
    print()
    
    while True:
        choice = show_menu()
        
        if choice == "1":
            await update_openai_key()
        elif choice == "2":
            await create_mock_provider()
        elif choice == "3":
            await disable_problematic_providers()
        elif choice == "4":
            await show_current_status()
        elif choice == "5":
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please enter 1-5.")
        
        input("\n⏸️ Press Enter to continue...")
    
    print("\n📋 Next Steps:")
    print("1. Restart your backend server")
    print("2. Go to http://localhost:8080/chat")
    print("3. Test with working provider")
    print("4. Add billing to OpenAI account for production")

if __name__ == "__main__":
    asyncio.run(main())
