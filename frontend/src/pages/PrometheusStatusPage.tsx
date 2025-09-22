import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Info, CheckCircle, AlertCircle, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HourlyStatus {
  hour: Date;
  status: string;
  uptime: number | null;
  responseTime: number | null;
  errorRate: number | null;
  hasData: boolean;
}

interface Component {
  name: string;
  description: string;
  uptimeQuery?: string;
  responseTimeQuery?: string;
  errorRateQuery?: string;
  hourlyStatus: HourlyStatus[];
  currentStatus: string;
}

interface UptimeData {
  hour: Date;
  status: string;
  hasData: boolean;
}

interface OrganizationInfo {
  id: string;
  name: string;
  org_id: string;
}

const PrometheusStatusPage: React.FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const [selectedDateRange, setSelectedDateRange] = useState({ 
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    end: new Date() // Now
  });
  const [uptimeData, setUptimeData] = useState<UptimeData[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationInfo, setOrganizationInfo] = useState<OrganizationInfo | null>(null);
  
  // Prometheus configuration
  const PROMETHEUS_URL = 'http://localhost:9090'; // Replace with your Prometheus URL
  const HOURS_TO_SHOW = 24; // 24 hours

  // Fetch organization info and services
  const fetchOrganizationData = async (): Promise<Component[]> => {
    try {
      const [orgResponse, servicesResponse] = await Promise.all([
        fetch(`/api/organizations/${organizationId}`),
        fetch(`/api/organizations/${organizationId}/services`)
      ]);

      if (!orgResponse.ok || !servicesResponse.ok) {
        throw new Error('Failed to fetch organization data');
      }

      const orgData = await orgResponse.json();
      const servicesData = await servicesResponse.json();

      setOrganizationInfo(orgData);
      
      // Convert services to component queries format
      const componentQueries = servicesData.map((service: any) => ({
        name: service.name,
        description: `Service: ${service.service_id}`,
        uptimeQuery: `up{job="org_${organizationId}",instance=~".*${service.service_id}.*"}`,
        responseTimeQuery: `http_request_duration_seconds{job="org_${organizationId}",instance=~".*${service.service_id}.*"}`,
        errorRateQuery: `rate(http_requests_total{job="org_${organizationId}",instance=~".*${service.service_id}.*",code!~"2.."}[5m])`
      }));

      return componentQueries;
    } catch (error) {
      console.error('Error fetching organization data:', error);
      setError('Failed to fetch organization data');
      return [];
    }
  };

  // Query Prometheus API
  const queryPrometheus = async (query: string, start: Date, end: Date, step = '5m'): Promise<any[]> => {
    try {
      const params = new URLSearchParams({
        query,
        start: start.toISOString(),
        end: end.toISOString(),
        step
      });
      
      const response = await fetch(`${PROMETHEUS_URL}/api/v1/query_range?${params}`);
      
      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data.result;
    } catch (error) {
      console.error('Prometheus query error:', error);
      return [];
    }
  };

  // Determine status based on metrics
  const determineStatus = (uptimeValue: number | null, errorRate: number | null, responseTime: number | null, hasData = true): string => {
    // If no data is available, return no-data status
    if (!hasData || (uptimeValue === null && errorRate === null && responseTime === null)) {
      return 'no-data';
    }
    
    // If service is down
    if (uptimeValue === 0) {
      return 'major-outage';
    }
    
    // If error rate is high (>5%)
    if (errorRate && errorRate > 0.05) {
      return 'partial-outage';
    }
    
    // If response time is slow (>1s for most endpoints)
    if (responseTime && responseTime > 1.0) {
      return 'degraded';
    }
    
    return 'operational';
  };

  // Format date range for display
  const formatDateRange = (start: Date, end: Date): string => {
    const startTime = start.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const endTime = end.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${startTime} - ${endTime}`;
  };

  // Navigate date range
  const navigateDateRange = (direction: 'prev' | 'next'): void => {
    const hoursToMove = HOURS_TO_SHOW;
    const millisecondsToMove = hoursToMove * 60 * 60 * 1000;
    
    const newRange = { ...selectedDateRange };
    
    if (direction === 'prev') {
      // Move back by the specified hours
      newRange.start = new Date(selectedDateRange.start.getTime() - millisecondsToMove);
      newRange.end = new Date(selectedDateRange.end.getTime() - millisecondsToMove);
    } else if (direction === 'next') {
      // Move forward by the specified hours (but not beyond current time)
      const now = new Date();
      const newEnd = new Date(selectedDateRange.end.getTime() + millisecondsToMove);
      
      // Don't navigate if we would go beyond current time
      if (newEnd > now) {
        return;
      }
      
      newRange.start = new Date(selectedDateRange.start.getTime() + millisecondsToMove);
      newRange.end = newEnd;
      
      // If the new end would be beyond now, cap it at now
      if (newRange.end > now) {
        newRange.end = now;
        newRange.start = new Date(now.getTime() - millisecondsToMove);
      }
    }
    
    setSelectedDateRange(newRange);
  };

  // Generate hour range based on selected period
  const generateHourRange = (startDate: Date, endDate: Date): Date[] => {
    const hours: Date[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Round to nearest hour
    current.setMinutes(0, 0, 0);
    
    while (current <= end) {
      hours.push(new Date(current));
      current.setHours(current.getHours() + 1);
    }
    
    return hours;
  };

  // Back to dashboard navigation
  const handleBackToDashboard = (): void => {
    navigate('/dashboard');
  };

  // Helper functions
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'operational': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'partial-outage': return 'bg-orange-500';
      case 'major-outage': return 'bg-red-500';
      case 'no-data': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  const calculateUptime = (): string => {
    if (uptimeData.length === 0) return '100.00';

    // Only count hours with data for uptime calculation
    const hoursWithData = uptimeData.filter(h => h.status !== 'no-data');
    if (hoursWithData.length === 0) return 'N/A';

    const operational = hoursWithData.filter(h => h.status === 'operational').length;
    return ((operational / hoursWithData.length) * 100).toFixed(2);
  };

  const getStatusIcon = (status: string): JSX.Element => {
    switch (status) {
      case 'operational': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'partial-outage': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'major-outage': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'no-data': return <Info className="w-4 h-4 text-gray-400" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded Performance';
      case 'partial-outage': return 'Partial Outage';
      case 'major-outage': return 'Major Outage';
      case 'no-data': return 'No Data';
      default: return 'Unknown';
    }
  };

  // Check if we can navigate forward
  const canNavigateNext = (): boolean => {
    const now = new Date();
    const potentialNewEnd = new Date(selectedDateRange.end.getTime() + (HOURS_TO_SHOW * 60 * 60 * 1000));
    return potentialNewEnd <= now;
  };

  // Generate mock data for demonstration
  const generateMockData = (): void => {
    const hours = generateHourRange(selectedDateRange.start, selectedDateRange.end);

    // Generate mock uptime data
    const mockUptimeData: UptimeData[] = hours.map(hour => ({
      hour,
      status: Math.random() > 0.1 ? 'operational' : (Math.random() > 0.5 ? 'degraded' : 'partial-outage'),
      hasData: Math.random() > 0.05 // 95% chance of having data
    }));

    // Generate mock components
    const mockComponents: Component[] = [
      {
        name: 'API Gateway',
        description: 'Main API endpoint',
        currentStatus: 'operational',
        hourlyStatus: hours.map(hour => ({
          hour,
          status: Math.random() > 0.15 ? 'operational' : 'degraded',
          uptime: Math.random() > 0.1 ? 1 : 0,
          responseTime: 0.1 + Math.random() * 0.5,
          errorRate: Math.random() * 0.02,
          hasData: true
        }))
      },
      {
        name: 'Database',
        description: 'Primary database cluster',
        currentStatus: 'operational',
        hourlyStatus: hours.map(hour => ({
          hour,
          status: Math.random() > 0.05 ? 'operational' : 'partial-outage',
          uptime: Math.random() > 0.05 ? 1 : 0,
          responseTime: 0.05 + Math.random() * 0.2,
          errorRate: Math.random() * 0.01,
          hasData: true
        }))
      }
    ];

    setUptimeData(mockUptimeData);
    setComponents(mockComponents);
  };

  // Main data fetching function
  const fetchPrometheusData = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // For now, use mock data since we don't have a real Prometheus setup
      // In a real implementation, you would:
      // 1. Fetch organization data
      // 2. Query Prometheus for each service
      // 3. Process the data into the required format

      generateMockData();

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch metrics data. Using mock data.');
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and when date range changes
  useEffect(() => {
    if (organizationId) {
      fetchPrometheusData();
    }
  }, [selectedDateRange, organizationId]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="mr-4 p-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {organizationInfo ? organizationInfo.name : 'Organization Status'}
            </h1>
            <p className="text-gray-600">
              Organization ID: {organizationId} - Real-time monitoring and alerting system status (Last {HOURS_TO_SHOW} hours)
            </p>
          </div>
          <button
            onClick={fetchPrometheusData}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-400 text-yellow-700">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* System Status Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">System status</h2>
          <div className="flex items-center space-x-2 text-gray-500">
            <ChevronLeft
              className="w-4 h-4 cursor-pointer hover:text-gray-700 hover:bg-gray-100 rounded p-0.5 transition-colors"
              onClick={() => navigateDateRange('prev')}
            />
            <span className="text-sm font-medium min-w-[200px] text-center text-xs">{formatDateRange(selectedDateRange.start, selectedDateRange.end)}</span>
            <ChevronRight
              className={`w-4 h-4 cursor-pointer hover:bg-gray-100 rounded p-0.5 transition-colors ${
                !canNavigateNext()
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => canNavigateNext() && navigateDateRange('next')}
            />
          </div>
        </div>

        {/* APIs Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium text-gray-900">Organization Services</span>
              <Info className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">{components.length} services</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{calculateUptime()}% uptime</span>
          </div>

          {/* Uptime Bar */}
          <div className="flex space-x-px mb-4">
            {loading ? (
              <div className="w-full h-8 bg-gray-200 animate-pulse rounded-sm"></div>
            ) : (
              uptimeData.map((hour, index) => (
                <div
                  key={index}
                  className={`h-8 flex-1 ${getStatusColor(hour.status)} rounded-sm cursor-pointer hover:opacity-80 transition-opacity`}
                  title={`${hour.hour.toLocaleString()}: ${getStatusText(hour.status)}${hour.hasData ? '' : ' - No monitoring data available'}`}
                />
              ))
            )}
          </div>

          {/* Individual Components */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-gray-300 rounded"></div>
                      <div className="h-4 bg-gray-300 rounded w-32"></div>
                    </div>
                    <div className="h-4 bg-gray-300 rounded w-20"></div>
                  </div>
                  <div className="flex space-x-px">
                    {Array.from({ length: HOURS_TO_SHOW }).map((_, index) => (
                      <div key={index} className="h-6 flex-1 bg-gray-300 rounded-sm"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            components.map((component, index) => {
              // Calculate component uptime
              const componentHoursWithData = component.hourlyStatus?.filter(h => h.status !== 'no-data') || [];
              const componentOperational = componentHoursWithData.filter(h => h.status === 'operational').length;
              const componentUptime = componentHoursWithData.length > 0
                ? ((componentOperational / componentHoursWithData.length) * 100).toFixed(2)
                : 'N/A';

              return (
                <div key={index} className="py-3 px-3 hover:bg-gray-50 rounded">
                  {/* Component Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(component.currentStatus)}
                      <div>
                        <span className="font-medium text-gray-900">{component.name}</span>
                        <p className="text-sm text-gray-500">{component.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600 capitalize block">{getStatusText(component.currentStatus)}</span>
                      <span className="text-xs text-gray-500">{componentUptime}% uptime</span>
                    </div>
                  </div>

                  {/* Component Uptime Bar */}
                  <div className="flex space-x-px">
                    {component.hourlyStatus ? (
                      component.hourlyStatus.map((hour, hourIndex) => (
                        <div
                          key={hourIndex}
                          className={`h-6 flex-1 ${getStatusColor(hour.status)} rounded-sm cursor-pointer hover:opacity-80 transition-opacity`}
                          title={`${hour.hour.toLocaleString()}: ${getStatusText(hour.status)}${hour.hasData ? (hour.responseTime ? ` - ${(hour.responseTime * 1000).toFixed(0)}ms` : '') + (hour.errorRate ? ` - ${(hour.errorRate * 100).toFixed(2)}% errors` : '') : ' - No monitoring data available'}`}
                        />
                      ))
                    ) : (
                      Array.from({ length: HOURS_TO_SHOW }).map((_, hourIndex) => (
                        <div
                          key={hourIndex}
                          className="h-6 flex-1 bg-gray-400 rounded-sm"
                          title="No data available"
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PrometheusStatusPage;
