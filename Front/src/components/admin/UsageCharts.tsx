// 📊 Usage Charts Component
// Data visualization for usage analytics with provider breakdown and trends
// Uses Recharts library for professional chart rendering

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Line,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

import { ProviderStats, UsageSummary } from '../../types/usage';

/**
 * Usage Charts Component
 * 
 * Learning: Data visualization is crucial for understanding usage patterns.
 * This component shows provider breakdowns, cost analysis, and performance
 * metrics in easy-to-understand charts.
 * 
 * Design Pattern: We use Recharts for consistent, responsive charts that
 * work well in admin dashboards. Each chart tells a specific story about usage.
 */

interface UsageChartsProps {
  summary: UsageSummary | null;
  isLoading: boolean;
  error: string | null;
}

const UsageCharts: React.FC<UsageChartsProps> = ({
  summary,
  isLoading,
  error
}) => {

  // =============================================================================
  // CHART CONFIGURATION (DEFINE COLORS FIRST)
  // =============================================================================

  /**
   * Chart color palette
   * 
   * Learning: Consistent colors improve dashboard usability.
   * We use a professional color palette that works well for business data.
   */
  const CHART_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green  
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#84CC16'  // Lime
  ];

  // =============================================================================
  // CHART DATA PROCESSING
  // =============================================================================

  /**
   * Process provider data for charts
   * 
   * Learning: Raw API data often needs transformation for charts.
   * We process the data to create chart-friendly formats with
   * proper sorting and color assignments.
   */
  const providerChartData = useMemo(() => {
    if (!summary?.providers) return [];
    
    return summary.providers
      .map((provider, index) => ({
        name: provider.provider,
        displayName: provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1),
        requests: provider.requests.total,
        successfulRequests: provider.requests.successful,
        failedRequests: provider.requests.total - provider.requests.successful,
        tokens: provider.tokens.total,
        cost: provider.cost.total_usd,
        avgResponseTime: provider.performance.average_response_time_ms,
        successRate: provider.requests.success_rate,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }))
      .sort((a, b) => b.requests - a.requests); // Sort by request count
  }, [summary?.providers]);

  /**
   * Process cost breakdown data
   * 
   * Learning: Financial data needs special handling for clarity.
   * We create separate views for cost analysis and budget tracking.
   * FIXED: Show chart even when all costs are 0 to prevent disappearing.
   */
  const costBreakdownData = useMemo(() => {
    if (!summary?.providers) return [];
    
    const totalCost = summary.overview.total_cost_usd;
    const hasAnyCost = summary.providers.some(provider => provider.cost.total_usd > 0);
    
    // If no provider has cost, show all providers with equal distribution for visualization
    if (!hasAnyCost && summary.providers.length > 0) {
      return summary.providers.map((provider, index) => ({
        name: provider.provider,
        displayName: provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1),
        cost: 0,
        percentage: (100 / summary.providers.length).toFixed(1),
        color: CHART_COLORS[index % CHART_COLORS.length],
        isZeroCost: true
      }));
    }
    
    // Normal case: filter providers with actual cost
    return summary.providers
      .filter(provider => provider.cost.total_usd > 0)
      .map((provider, index) => ({
        name: provider.provider,
        displayName: provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1),
        cost: provider.cost.total_usd,
        percentage: (provider.cost.total_usd / totalCost * 100).toFixed(1),
        color: CHART_COLORS[index % CHART_COLORS.length],
        isZeroCost: false
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [summary?.providers, summary?.overview.total_cost_usd]);

  /**
   * Process performance data
   * 
   * Learning: Performance metrics help identify optimization opportunities.
   * We combine multiple metrics to show provider efficiency.
   */
  const performanceData = useMemo(() => {
    if (!summary?.providers) return [];
    
    return summary.providers
      .map((provider, index) => ({
        name: provider.provider,
        displayName: provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1),
        responseTime: provider.performance.average_response_time_ms,
        successRate: provider.requests.success_rate,
        costPerRequest: provider.cost.average_per_request,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }))
      .sort((a, b) => a.responseTime - b.responseTime); // Sort by performance
  }, [summary?.providers]);



  /**
   * Custom tooltip for better data display
   * 
   * Learning: Default tooltips often don't format data well.
   * Custom tooltips provide better context and formatting.
   */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  /**
   * Custom label for pie charts
   * 
   * Learning: Pie chart labels need careful positioning and formatting
   * to avoid overlap and provide clear information.
   */
  const renderPieLabel = ({ name, percentage }: any) => {
    return `${name}: ${percentage}%`;
  };

  // =============================================================================
  // LOADING AND ERROR STATES
  // =============================================================================

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8 text-center">
        <p className="text-gray-600">
          {error ? `Failed to load chart data: ${error}` : 'No data available for charts.'}
        </p>
      </div>
    );
  }

  // =============================================================================
  // CHART COMPONENTS
  // =============================================================================

  return (
    <div className="space-y-6 mb-8">
      
      {/* Provider Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Requests by Provider Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Requests by Provider
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={providerChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="displayName" 
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="successfulRequests" 
                name="Successful" 
                fill="#10B981" 
                stackId="requests"
              />
              <Bar 
                dataKey="failedRequests" 
                name="Failed" 
                fill="#EF4444" 
                stackId="requests"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Distribution Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Cost Distribution by Provider
            {costBreakdownData.length > 0 && costBreakdownData[0]?.isZeroCost && (
              <span className="ml-2 text-sm text-gray-500 font-normal">
                (No costs in selected period)
              </span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={costBreakdownData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPieLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey={costBreakdownData.length > 0 && costBreakdownData[0]?.isZeroCost ? "percentage" : "cost"}
              >
                {costBreakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (costBreakdownData.length > 0 && costBreakdownData[0]?.isZeroCost) {
                    return [`${value}%`, 'Distribution'];
                  }
                  return [`${Number(value).toFixed(4)}`, 'Cost'];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {costBreakdownData.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4">
                No provider data available
              </div>
            ) : costBreakdownData[0]?.isZeroCost ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">i</span>
                  </div>
                  <span className="text-blue-800 text-sm font-medium">
                    No costs recorded in the selected period. Chart shows provider availability.
                  </span>
                </div>
              </div>
            ) : null}
            {costBreakdownData.map((provider, index) => (
              <div key={provider.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: provider.color }}
                  ></div>
                  <span className="text-gray-700">{provider.displayName}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">
                    {provider.isZeroCost ? 'Available' : `${provider.cost.toFixed(4)}`}
                  </span>
                  <span className="text-gray-500 ml-2">({provider.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Performance and Efficiency Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Response Time Comparison */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Average Response Time by Provider
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="displayName" 
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Response Time']}
              />
              <Area
                type="monotone"
                dataKey="responseTime"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Success Rate Comparison */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Success Rate by Provider
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="displayName" 
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                domain={[80, 100]}
                label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Success Rate']}
              />
              <Bar 
                dataKey="successRate" 
                fill="#10B981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Token Usage Analysis */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Token Usage and Cost Efficiency
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={providerChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayName" 
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="tokens"
              orientation="left"
              tick={{ fontSize: 12 }}
              label={{ value: 'Tokens', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="cost"
              orientation="right"
              tick={{ fontSize: 12 }}
              label={{ value: 'Cost ($)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              yAxisId="tokens"
              dataKey="tokens" 
              name="Total Tokens" 
              fill="#8B5CF6"
            />
            <Line 
              yAxisId="cost"
              type="monotone" 
              dataKey="cost" 
              name="Total Cost ($)" 
              stroke="#F59E0B"
              strokeWidth={3}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {providerChartData.map((provider) => (
            <div key={provider.name} className="bg-gray-50 rounded p-3">
              <div className="font-medium text-gray-900 mb-1">{provider.displayName}</div>
              <div className="space-y-1 text-gray-600">
                <div>Tokens: {provider.tokens.toLocaleString()}</div>
                <div>Cost: ${provider.cost.toFixed(4)}</div>
                <div>
                  Efficiency: {provider.tokens > 0 ? (provider.cost / provider.tokens * 1000).toFixed(2) : '0'} $/1K tokens
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default UsageCharts;
