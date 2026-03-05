import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function UsageDashboard() {
  const summaryQuery = trpc.usage.getSummary.useQuery({ days: 30 });
  const dailyQuery = trpc.usage.getDailyUsage.useQuery({ days: 14 });

  const summary = summaryQuery.data as { totalTokens: number; totalRequests: number; successRate: number; totalCost: number } | undefined;
  const daily = (dailyQuery.data as Array<{ date: string; tokens: number; requests: number; cost: number }> | undefined) || [];

  const totalRequests = summary?.totalRequests ?? 0;
  const totalTokens = summary?.totalTokens ?? 0;
  const totalCost = summary?.totalCost ?? 0;
  const successRate = summary?.successRate ?? 1;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? <Loader2 className="size-4 animate-spin" /> : (
              <div className="text-2xl font-bold">{totalRequests}</div>
            )}
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? <Loader2 className="size-4 animate-spin" /> : (
              <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? <Loader2 className="size-4 animate-spin" /> : (
              <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            )}
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? <Loader2 className="size-4 animate-spin" /> : (
              <div className="text-2xl font-bold">{(successRate * 100).toFixed(1)}%</div>
            )}
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Usage Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage Trend</CardTitle>
          <CardDescription>Requests and tokens over the last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : daily.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No usage data available yet. Start chatting to see stats here.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="requests" stroke="#3b82f6" name="Requests" />
                <Line type="monotone" dataKey="tokens" stroke="#8b5cf6" name="Tokens" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
