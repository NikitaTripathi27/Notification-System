import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  iconBgColor: string;
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon, 
  iconBgColor 
}: MetricCardProps) {
  const changeColorClass = {
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    neutral: 'text-slate-500'
  }[changeType];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${iconBgColor}`}>
            {icon}
          </div>
        </div>
        {change && (
          <p className={`text-xs mt-2 ${changeColorClass}`}>
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
