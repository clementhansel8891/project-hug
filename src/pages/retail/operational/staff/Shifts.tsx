import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock,
  Play,
  Square,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  CheckCircle,
  Calculator,
  Banknote,
  CreditCard,
  Smartphone,
  Receipt,
  User,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { formatTime } from '@/lib/mock-data';
import { toast } from '@/hooks/use-toast';
import { attendanceService } from '@/core/services/hr/attendanceService';
import { useSession } from '@/core/security/session';
import { retailService } from '@/core/services/retail/retailService';
import { Loader2 } from 'lucide-react';

interface ShiftRecord {
  id: string;
  staffId: string;
  staffName: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  totalSales: number;
  transactions: number;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  refunds: number;
  notes?: string;
  status: 'open' | 'closed';
}





interface Denominations {
  hundreds: number;
  fifties: number;
  twenties: number;
  tens: number;
  fives: number;
  ones: number;
  quarters: number;
  dimes: number;
  nickels: number;
  pennies: number;
}


export default function RetailShifts() {
  const session = useSession();
  const { state, startShift, endShift } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [shiftHistory, setShiftHistory] = useState<ShiftRecord[]>([]);
  const [currentShift, setCurrentShift] = useState<ShiftRecord | null>(null);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [clockInReason, setClockInReason] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [denominations, setDenominations] = useState<Denominations>({
    hundreds: 0,
    fifties: 0,
    twenties: 0,
    tens: 0,
    fives: 0,
    ones: 0,
    quarters: 0,
    dimes: 0,
    nickels: 0,
    pennies: 0,
  });

  const calculatedTotal =
    denominations.hundreds * 100 +
    denominations.fifties * 50 +
    denominations.twenties * 20 +
    denominations.tens * 10 +
    denominations.fives * 5 +
    denominations.ones * 1 +
    denominations.quarters * 0.25 +
    denominations.dimes * 0.1 +
    denominations.nickels * 0.05 +
    denominations.pennies * 0.01;

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      const data = await retailService.listShifts(session.tenant_id!, session, {
        store_id: state.settings.defaultLocationId || undefined
      });
      
      // Map backend RetailShift to frontend ShiftRecord
      const mapped: ShiftRecord[] = (data || []).map(s => ({
        id: s.id,
        staffId: (s as any).employee_id || (s as any).employeeId || 'Unknown',
        staffName: (s as any).employeeName || 'Staff Member',
        startTime: (s as any).start_time || (s as any).startTime || new Date().toISOString(),
        endTime: (s as any).end_time || (s as any).endTime,
        openingCash: Number((s as any).opening_cash || (s as any).openingCash || 0),
        closingCash: Number((s as any).closing_cash || (s as any).closingCash || 0),
        expectedCash: Number((s as any).expected_cash || (s as any).expectedCash || 0),
        cashDifference: Number((s as any).variance || (s as any).actual_cash ? (Number((s as any).actual_cash) - Number((s as any).expected_cash)) : 0),
        totalSales: Number((s as any).total_sales || 0),
        transactions: Number((s as any).transaction_count || 0),
        cashSales: Number((s as any).cash_sales || 0),
        cardSales: Number((s as any).card_sales || 0),
        mobileSales: Number((s as any).mobile_sales || 0),
        refunds: Number((s as any).refund_count || 0),
        notes: s.notes,
        status: (s as any).status === 'open' ? 'open' : 'closed',
      }));

      setShiftHistory(mapped);
    } catch (e) {
      toast({
        title: "Sync Error",
        description: "Failed to pull authoritative shift logs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session.tenant_id) {
      fetchShifts();
    }
  }, [session.tenant_id, state.settings.defaultLocationId]);

  // Dynamic Statistics
  const today = new Date().toISOString().split('T')[0];
  const todayShifts = (shiftHistory || []).filter(s => s.startTime.startsWith(today));
  const todaySales = todayShifts.reduce((sum, s) => sum + (s.totalSales || 0), 0);
  const totalVariance = todayShifts.reduce((sum, s) => sum + (s.cashDifference || 0), 0);

  // Handle start shift
  const handleStartShift = async () => {
    const opening = parseFloat(openingCash) || 0;
    
    if (!clockInReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for starting an unscheduled shift.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // 1. Log to backend attendance system
      await attendanceService.clockIn(session.tenant_id, session, {
        locationId: state.settings.defaultLocationId || '1', // Fallback for demo
        deviceId: 'WEB_PORTAL',
        verificationMethod: 'MANUAL',
        reason: clockInReason
      });

      // 2. Start local retail shift session
      const newShift: ShiftRecord = {
        id: `shift-${Date.now()}`,
        staffId: state.currentUser?.id || '1',
        staffName: state.currentUser?.name || 'Current User',
        startTime: new Date().toISOString(),
        openingCash: opening,
        totalSales: 0,
        transactions: 0,
        cashSales: 0,
        cardSales: 0,
        mobileSales: 0,
        refunds: 0,
        notes: clockInReason,
        status: 'open',
      };

      setCurrentShift(newShift);
      startShift(opening);
      setIsStartOpen(false);
      setClockInReason(''); 
      
      // Refresh history
      fetchShifts();
      
      toast({
        title: 'Shift started',
        description: `Opening cash: ${formatCurrency(opening)}`,
      });
    } catch (err) {
      toast({
        title: 'Clock-in failed',
        description: 'Unable to register attendance with the system.',
        variant: 'destructive',
      });
    }
  };

  // Handle end shift
  const handleEndShift = () => {
    if (!currentShift) return;

    const closing = parseFloat(closingCash) || calculatedTotal;
    // Simulated expected cash calculation
    const expectedCash = currentShift.openingCash + (currentShift.cashSales || 0);
    const difference = closing - expectedCash;

    const closedShift: ShiftRecord = {
      ...currentShift,
      endTime: new Date().toISOString(),
      closingCash: closing,
      expectedCash,
      cashDifference: difference,
      totalSales: currentShift.totalSales || 0,
      transactions: currentShift.transactions || 0,
      cashSales: currentShift.cashSales || 0,
      cardSales: currentShift.cardSales || 0,
      mobileSales: currentShift.mobileSales || 0,
      notes: shiftNotes,
      status: 'closed',
    };

    setShiftHistory((prev) => [closedShift, ...prev]);
    setCurrentShift(null);
    endShift(closing);
    setIsEndOpen(false);
    
    // Refresh history from server
    fetchShifts();

    setClosingCash('');
    setShiftNotes('');
    setDenominations({
      hundreds: 0,
      fifties: 0,
      twenties: 0,
      tens: 0,
      fives: 0,
      ones: 0,
      quarters: 0,
      dimes: 0,
      nickels: 0,
      pennies: 0,
    });

    toast({
      title: 'Shift ended',
      description: `Cash variance: ${formatCurrency(difference)}`,
    });
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Sales</p>
                <p className="text-xl font-bold">{formatCurrency(todaySales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/50">
                <Users className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Shifts</p>
                <p className="text-xl font-bold">{todayShifts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                totalVariance >= 0 ? "bg-success" : "bg-destructive/10"
              )}>
                {totalVariance >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Variance</p>
                <p className={cn(
                  "text-xl font-bold",
                  totalVariance >= 0 ? "text-success" : "text-destructive"
                )}>
                  {totalVariance >= 0 ? '+' : ''}{formatCurrency(totalVariance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                currentShift ? "bg-success" : "bg-muted"
              )}>
                <Clock className={cn(
                  "h-5 w-5",
                  currentShift ? "text-success" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Shift</p>
                <p className="text-xl font-bold">
                  {currentShift ? formatDuration(currentShift.startTime) : 'No active'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Shift Card */}
      {currentShift && (
        <Card className="border-success/50 bg-success">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-success">
                  <Clock className="h-6 w-6 text-success" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Active Shift</h3>
                    <Badge variant="default" className="bg-success">In Progress</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {currentShift.staffName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Started {formatTime(currentShift.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Banknote className="h-4 w-4" />
                      Opening: {formatCurrency(currentShift.openingCash)}
                    </span>
                  </div>
                </div>
              </div>
              <Button onClick={() => setIsEndOpen(true)} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                End Shift
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Shift Button (when no active shift) */}
      {!currentShift && (
        <Card className="border-dashed">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No active shift</p>
            <Button size="lg" onClick={() => setIsStartOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              Start New Shift
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Shift History */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Shift History</CardTitle>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-28rem)]">
            {isLoading && shiftHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Synchronizing with Registry...</p>
              </div>
            ) : (
              <div className="divide-y">
                {(Array.isArray(shiftHistory) ? shiftHistory : []).map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setSelectedShift(shift);
                    setIsDetailOpen(true);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{shift.staffName}</span>
                        <Badge variant="secondary">{shift.id}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(shift.startTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(shift.startTime)} - {shift.endTime ? formatTime(shift.endTime) : 'Active'}
                        </span>
                        <span>{formatDuration(shift.startTime, shift.endTime)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(shift.totalSales)}</p>
                      <p className="text-sm text-muted-foreground">
                        {shift.transactions} transactions
                      </p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      {shift.cashDifference !== undefined && (
                        <div className={cn(
                          "flex items-center gap-1 justify-end",
                          shift.cashDifference > 0 ? "text-success" :
                          shift.cashDifference < 0 ? "text-destructive" :
                          "text-muted-foreground"
                        )}>
                          {shift.cashDifference > 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : shift.cashDifference < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            {shift.cashDifference >= 0 ? '+' : ''}
                            {formatCurrency(shift.cashDifference)}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">variance</p>
                    </div>
                  </div>
                </div>
              ))}
              {!isLoading && shiftHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Clock className="h-8 w-8 mb-4 opacity-20" />
                  <p>No shift records found for this node.</p>
                </div>
              )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Start Shift Dialog */}
      <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Shift</DialogTitle>
            <DialogDescription>
              Count your opening cash drawer and enter the total below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Opening Cash Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="pl-9 text-lg"
                  placeholder="200.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unscheduled Reason <Badge variant="outline" className="ml-2 text-[10px] uppercase">Mandatory Audit</Badge></Label>
              <Textarea
                placeholder="Briefly explain why this unscheduled shift is being started..."
                value={clockInReason}
                onChange={(e) => setClockInReason(e.target.value)}
                className="min-h-[80px]"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                This reason will be logged for HOD review as part of the workforce compliance audit.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Standard opening float: {formatCurrency(200)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStartOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartShift}>
              <Play className="h-4 w-4 mr-2" />
              Start Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Shift Dialog */}
      <Dialog open={isEndOpen} onOpenChange={setIsEndOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>End Shift & Cash Reconciliation</DialogTitle>
            <DialogDescription>
              Count your cash drawer and enter amounts below for reconciliation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            {/* Denomination Calculator */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Cash Counter
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Rp 100.000', key: 'hundreds', value: 100000 },
                  { label: 'Rp 50.000', key: 'fifties', value: 50000 },
                  { label: 'Rp 20.000', key: 'twenties', value: 20000 },
                  { label: 'Rp 10.000', key: 'tens', value: 10000 },
                  { label: 'Rp 5.000', key: 'fives', value: 5000 },
                  { label: 'Rp 1.000', key: 'ones', value: 1000 },
                  { label: 'Rp 500', key: 'quarters', value: 500 },
                  { label: 'Rp 200', key: 'dimes', value: 200 },
                ].map((denom) => (
                  <div key={denom.key} className="flex items-center gap-2">
                    <span className="w-10 text-muted-foreground">{denom.label}</span>
                    <Input
                      type="number"
                      min="0"
                      value={denominations[denom.key as keyof typeof denominations]}
                      onChange={(e) =>
                        setDenominations((prev) => ({
                          ...prev,
                          [denom.key]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="h-8 text-center"
                    />
                  </div>
                ))}
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Calculated Total</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(calculatedTotal)}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <h4 className="font-medium">Shift Summary</h4>
              {currentShift && (
                <div className="space-y-3">
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Opening Cash</span>
                    <span className="font-medium">{formatCurrency(currentShift.openingCash)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Expected Cash Sales</span>
                    <span className="font-medium">{formatCurrency(currentShift.cashSales || 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Expected Total</span>
                    <span className="font-bold">{formatCurrency(currentShift.openingCash + (currentShift.cashSales || 0))}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Actual Count</span>
                    <span className="font-bold">{formatCurrency(calculatedTotal)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between p-3 rounded-lg">
                    <span className="text-muted-foreground">Variance</span>
                    <span className={cn(
                      "font-bold",
                      calculatedTotal - (currentShift.openingCash + (currentShift.cashSales || 0)) >= 0
                        ? "text-success"
                        : "text-destructive",
                    )}>
                      {calculatedTotal - (currentShift.openingCash + (currentShift.cashSales || 0)) >= 0 ? "+" : ""}
                      {formatCurrency(calculatedTotal - (currentShift.openingCash + (currentShift.cashSales || 0)))}
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Any notes about this shift..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEndOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEndShift}>
              <Square className="h-4 w-4 mr-2" />
              End Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <User className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedShift.staffName}</p>
                  <p className="text-sm text-muted-foreground">{selectedShift.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">Start Time</p>
                  <p className="font-medium">{formatTime(selectedShift.startTime)}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">End Time</p>
                  <p className="font-medium">
                    {selectedShift.endTime ? formatTime(selectedShift.endTime) : '-'}
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {formatDuration(selectedShift.startTime, selectedShift.endTime)}
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="font-medium">{selectedShift.transactions}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Sales Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="flex items-center gap-2">
                      <Banknote className="h-4 w-4" /> Cash
                    </span>
                    <span className="font-medium">{formatCurrency(selectedShift.cashSales)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Card
                    </span>
                    <span className="font-medium">{formatCurrency(selectedShift.cardSales)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" /> Mobile
                    </span>
                    <span className="font-medium">{formatCurrency(selectedShift.mobileSales)}</span>
                  </div>
                  {selectedShift.refunds > 0 && (
                    <div className="flex items-center justify-between p-2 bg-destructive/10 rounded text-destructive">
                      <span className="flex items-center gap-2">
                        <Receipt className="h-4 w-4" /> Refunds
                      </span>
                      <span className="font-medium">-{formatCurrency(selectedShift.refunds)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between p-2 font-semibold">
                    <span>Total Sales</span>
                    <span className="text-primary">{formatCurrency(selectedShift.totalSales)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Cash Reconciliation</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Opening</p>
                    <p className="font-medium">{formatCurrency(selectedShift.openingCash)}</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Expected</p>
                    <p className="font-medium">{formatCurrency(selectedShift.expectedCash || 0)}</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Actual</p>
                    <p className="font-medium">{formatCurrency(selectedShift.closingCash || 0)}</p>
                  </div>
                </div>
                {selectedShift.cashDifference !== undefined && (
                  <div className={cn(
                    "p-3 rounded-lg flex items-center justify-between",
                    selectedShift.cashDifference >= 0 ? "bg-success" : "bg-destructive/10"
                  )}>
                    <span className="font-medium">Variance</span>
                    <span className={cn(
                      "font-bold flex items-center gap-1",
                      selectedShift.cashDifference >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {selectedShift.cashDifference >= 0 ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      {selectedShift.cashDifference >= 0 ? '+' : ''}
                      {formatCurrency(selectedShift.cashDifference)}
                    </span>
                  </div>
                )}
              </div>

              {selectedShift.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedShift.notes}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
