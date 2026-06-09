import React from 'react';
import { AlertTriangle, CheckCircle, Clock, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DataQualityIndicatorProps {
  qualityScore: number;
  source: string;
  lastUpdated: Date;
  showDetails?: boolean;
}

export function DataQualityIndicator({ 
  qualityScore, 
  source, 
  lastUpdated,
  showDetails = true 
}: DataQualityIndicatorProps) {
  const getQualityColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.7) return 'text-yellow-600';
    if (score >= 0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getQualityBg = (score: number) => {
    if (score >= 0.9) return 'bg-green-50 border-green-200';
    if (score >= 0.7) return 'bg-yellow-50 border-yellow-200';
    if (score >= 0.5) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getSourceIcon = (source: string) => {
    if (source === 'REAL_NSE') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (source === 'SYNTHETIC') return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    if (source === 'UPSTOX_API') return <CheckCircle className="h-4 w-4 text-blue-600" />;
    return <WifiOff className="h-4 w-4 text-gray-400" />;
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'REAL_NSE': 'NSE Live Data',
      'SYNTHETIC': 'Simulated Data',
      'UPSTOX_API': 'Upstox API',
      'UNAVAILABLE': 'Data Unavailable'
    };
    return labels[source] || source;
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  if (!showDetails) {
    return (
      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs border ${getQualityBg(qualityScore)}`}>
        {getSourceIcon(source)}
        <span className={getQualityColor(qualityScore)}>
          {getSourceLabel(source)}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${getQualityBg(qualityScore)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getSourceIcon(source)}
          <span className={`font-medium ${getQualityColor(qualityScore)}`}>
            {getSourceLabel(source)}
          </span>
        </div>
        <Badge variant="outline">
          Quality: {(qualityScore * 100).toFixed(0)}%
        </Badge>
      </div>
      
      {source === 'SYNTHETIC' && (
        <div className="mt-2 text-sm text-orange-700">
          <AlertTriangle className="inline h-3 w-3 mr-1" />
          This data is simulated for demonstration purposes only
        </div>
      )}
      
      {source === 'UNAVAILABLE' && (
        <div className="mt-2 text-sm text-red-700">
          <WifiOff className="inline h-3 w-3 mr-1" />
          Data source currently unavailable
        </div>
      )}
      
      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Updated {getTimeAgo(lastUpdated)}
      </div>
    </div>
  );
}