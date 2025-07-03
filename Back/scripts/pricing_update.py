#!/usr/bin/env python3
"""
AI Dock Pricing Update Management Script
Run this script to update LLM configuration pricing with current LiteLLM data
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.services.litellm_pricing_service import get_pricing_service
from app.core.database import AsyncSessionLocal
from app.models.llm_config import LLMConfiguration
from sqlalchemy import select

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def update_all_pricing(force_refresh: bool = False):
    """
    Update pricing for all LLM configurations.
    
    Args:
        force_refresh: Force refresh from LiteLLM API
    """
    logger.info("🚀 Starting pricing update for all LLM configurations")
    
    pricing_service = get_pricing_service()
    
    try:
        # Get all active configurations
        async with AsyncSessionLocal() as session:
            stmt = select(LLMConfiguration).where(LLMConfiguration.is_active == True)
            result = await session.execute(stmt)
            configs = result.scalars().all()
            
            logger.info(f"Found {len(configs)} active LLM configurations to update")
            
            if not configs:
                logger.warning("No active LLM configurations found")
                return
            
            # Update each configuration
            successful_updates = 0
            failed_updates = 0
            
            for config in configs:
                try:
                    provider = config.provider.value if hasattr(config.provider, 'value') else str(config.provider)
                    model = config.default_model
                    
                    logger.info(f"📋 Updating pricing for {config.name} ({provider}:{model})")
                    
                    # Get current pricing from LiteLLM
                    pricing = await pricing_service.get_model_pricing(provider, model, force_refresh)
                    
                    if pricing and (pricing["input_cost_per_1k"] or pricing["output_cost_per_1k"]):
                        # Update configuration
                        old_input = float(config.cost_per_1k_input_tokens or 0)
                        old_output = float(config.cost_per_1k_output_tokens or 0)
                        
                        config.cost_per_1k_input_tokens = pricing["input_cost_per_1k"]
                        config.cost_per_1k_output_tokens = pricing["output_cost_per_1k"]
                        config.cost_per_request = pricing["request_cost"] or 0
                        
                        await session.commit()
                        
                        logger.info(f"✅ Updated {config.name}:")
                        logger.info(f"   Input: ${old_input:.6f} → ${pricing['input_cost_per_1k']:.6f} per 1k tokens")
                        logger.info(f"   Output: ${old_output:.6f} → ${pricing['output_cost_per_1k']:.6f} per 1k tokens")
                        
                        successful_updates += 1
                    else:
                        logger.warning(f"⚠️ No pricing data available for {config.name}")
                        failed_updates += 1
                    
                    # Small delay to avoid rate limits
                    await asyncio.sleep(0.2)
                    
                except Exception as config_error:
                    logger.error(f"❌ Failed to update {config.name}: {str(config_error)}")
                    failed_updates += 1
                    await session.rollback()
            
            # Summary
            logger.info(f"🎯 Pricing update completed:")
            logger.info(f"   ✅ Successful: {successful_updates}")
            logger.info(f"   ❌ Failed: {failed_updates}")
            logger.info(f"   📈 Success rate: {(successful_updates / len(configs) * 100):.1f}%")
            
    except Exception as e:
        logger.error(f"❌ Critical error during pricing update: {str(e)}")
        raise


async def show_current_pricing():
    """Show current pricing for all configurations."""
    logger.info("📊 Current LLM Configuration Pricing:")
    
    async with AsyncSessionLocal() as session:
        stmt = select(LLMConfiguration).where(LLMConfiguration.is_active == True)
        result = await session.execute(stmt)
        configs = result.scalars().all()
        
        for config in configs:
            provider = config.provider.value if hasattr(config.provider, 'value') else str(config.provider)
            input_cost = float(config.cost_per_1k_input_tokens or 0)
            output_cost = float(config.cost_per_1k_output_tokens or 0)
            
            print(f"\n{config.name} ({provider}:{config.default_model})")
            print(f"  Input:  ${input_cost:.6f} per 1k tokens")
            print(f"  Output: ${output_cost:.6f} per 1k tokens")
            
            if input_cost == 0 and output_cost == 0:
                print("  ⚠️  WARNING: Pricing is zero - needs update!")


async def check_litellm_availability():
    """Check if LiteLLM is available and working."""
    logger.info("🔍 Checking LiteLLM availability...")
    
    pricing_service = get_pricing_service()
    cache_stats = pricing_service.get_cache_stats()
    
    if cache_stats["litellm_available"]:
        logger.info("✅ LiteLLM is available")
        
        # Test with a common model
        try:
            test_pricing = await pricing_service.get_model_pricing("openai", "gpt-4", force_refresh=True)
            if test_pricing:
                logger.info(f"✅ LiteLLM test successful - GPT-4 pricing: ${test_pricing['input_cost_per_1k']:.6f}/1k input")
            else:
                logger.warning("⚠️ LiteLLM available but returned no pricing data")
        except Exception as e:
            logger.error(f"❌ LiteLLM test failed: {str(e)}")
    else:
        logger.error("❌ LiteLLM is not available - install with: pip install litellm")


async def main():
    """Main function with CLI interface."""
    if len(sys.argv) < 2:
        print("""
AI Dock Pricing Update Script

Usage:
  python pricing_update.py show          # Show current pricing
  python pricing_update.py check         # Check LiteLLM availability  
  python pricing_update.py update        # Update all pricing (cached)
  python pricing_update.py update-force  # Force update from LiteLLM API
        """)
        return
    
    command = sys.argv[1].lower()
    
    try:
        if command == "show":
            await show_current_pricing()
        elif command == "check":
            await check_litellm_availability()
        elif command == "update":
            await update_all_pricing(force_refresh=False)
        elif command == "update-force":
            await update_all_pricing(force_refresh=True)
        else:
            logger.error(f"Unknown command: {command}")
            return
            
    except Exception as e:
        logger.error(f"❌ Command failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
