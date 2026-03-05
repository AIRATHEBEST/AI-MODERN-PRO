import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

export function UsageDashboard() {
  const summaryQuery = trpc.usage.getSummary.useQuery({ days: 30 });
  const dailyQuery = trpc.usage.getDailyUsage.useQuery({ days: 14 });

  const summary = summaryQuery.data || [];
  const daily = dailyQuery.data || [];

  const totalRequests = summary.reduce((sum, item: any) => sum + (item.totalRequests || 0), 0);
  const totalTokens = summary.reduce((sum, item: any) => sum + (item.totalTokens || 0), 0);
  const totalCost = summary.reduce((sum, item: any) => sum + (item.totalCost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
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
            {summaryQuery.isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
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
            {summaryQuery.isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            )}
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Provider</CardTitle>
          <CardDescription>Request distribution across providers</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : summary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No usage data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={summary}
                  dataKey="totalRequests"
                  nameKey="provider"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {summary.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Daily Usage Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage Trend</CardTitle>
          <CardDescription>Requests over the last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : daily.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No usage data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalRequests"
                  stroke="#3b82f6"
                  name="Requests"
                />
                <Line
                  type="monotone"
                  dataKey="totalTokens"
                  stroke="#8b5cf6"
                  name="Tokens"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Provider Details */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Details</CardTitle>
          <CardDescription>Detailed metrics per provider</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : summary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No usage data available
            </p>
          ) : (
            <div className="space-y-2">
              {summary.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.provider}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.model || "Multiple models"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{item.totalRequests} requests</p>
                    <p className="text-sm text-muted-foreground">
                      {item.totalTokens?.toLocaleString()} tokens
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
