import { useState, useEffect, useMemo } from 'react';
import { Manuscript, Status } from '../types';

export type SortKey = 'status' | 'manuscriptId' | 'dateReceived' | 'priority' | 'statusDate';
export type SortDirection = 'asc' | 'desc' | null;

interface UseManuscriptListProps {
  manuscripts: Manuscript[];
  activeFilter: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER';
}

export const useManuscriptList = ({ manuscripts, activeFilter }: UseManuscriptListProps) => {
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER'>(activeFilter);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ 
    start: '', 
    end: '', 
    field: 'dateReceived' 
  });

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'statusDate',
    direction: 'desc'
  });

  useEffect(() => {
    setFilterStatus(activeFilter);
    setSelectedIds(new Set()); 
  }, [activeFilter]);

  // Daily Stats
  const dailyStats = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    const workedToday = manuscripts.filter(m => {
        const d = m.completedDate || m.dateStatusChanged || m.dateUpdated;
        return d && d.split('T')[0] === today && (m.status === Status.WORKED || m.status === Status.BILLED);
    }).length;
    
    return { workedToday };
  }, [manuscripts]);

  // Counts
  const pendingCount = manuscripts.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length;
  const handoverCount = manuscripts.filter(m => m.status === Status.WORKED || m.status === Status.PENDING_JM).length;
  
  const counts = {
    ALL: manuscripts.length,
    UNTOUCHED: manuscripts.filter(m => m.status === Status.UNTOUCHED).length,
    PENDING_GROUP: pendingCount,
    WORKED: manuscripts.filter(m => m.status === Status.WORKED).length,
    HANDOVER: handoverCount
  };

  const statusWeight: Record<Status, number> = {
    [Status.BILLED]: 5,
    [Status.WORKED]: 4,
    [Status.PENDING_CED]: 3,
    [Status.PENDING_TL]: 2,
    [Status.PENDING_JM]: 1,
    [Status.UNTOUCHED]: 0
  };

  const priorityWeight = {
    'Urgent': 3,
    'High': 2,
    'Normal': 1
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSorted = useMemo(() => {
    let result = manuscripts.filter(m => {
      let matchesStatus = false;
      if (filterStatus === 'ALL') matchesStatus = true;
      else if (filterStatus === 'PENDING_GROUP') {
        matchesStatus = [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
      } else if (filterStatus === 'HANDOVER') {
        matchesStatus = m.status === Status.WORKED || m.status === Status.PENDING_JM;
      } else {
        matchesStatus = m.status === filterStatus;
      }

      const statusLabel = m.status.toLowerCase().replace(/_/g, ' ');
      const matchesSearch = 
        m.manuscriptId.toLowerCase().includes(search.toLowerCase()) || 
        m.journalCode.toLowerCase().includes(search.toLowerCase()) ||
        statusLabel.includes(search.toLowerCase());

      const matchesDate = (() => {
        if (!dateRange.start && !dateRange.end) return true;
        let dateValue: string | undefined;
        if (dateRange.field === 'dateStatusChanged') {
             dateValue = (m.status === Status.WORKED && m.completedDate) 
               ? m.completedDate 
               : (m.dateStatusChanged || m.dateUpdated);
        } else if (dateRange.field === 'dueDate') {
             dateValue = m.dueDate;
        } else {
             dateValue = m.dateReceived;
        }
        if (!dateValue) return false;
        const itemTime = new Date(dateValue).getTime();
        if (isNaN(itemTime)) return false;
        const startTime = dateRange.start ? new Date(dateRange.start).setHours(0,0,0,0) : -Infinity;
        const endTime = dateRange.end ? new Date(dateRange.end).setHours(23,59,59,999) : Infinity;
        return itemTime >= startTime && itemTime <= endTime;
      })();

      return matchesStatus && matchesSearch && matchesDate;
    });

    if (sortConfig.direction) {
      result.sort((a, b) => {
        let valA: any;
        let valB: any;
        switch (sortConfig.key) {
          case 'status':
            valA = statusWeight[a.status];
            valB = statusWeight[b.status];
            break;
          case 'manuscriptId':
            valA = a.manuscriptId.toLowerCase();
            valB = b.manuscriptId.toLowerCase();
            break;
          case 'priority':
            valA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
            valB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
            break;
          case 'statusDate':
            valA = new Date((a.status === Status.WORKED && a.completedDate) ? a.completedDate : (a.dateStatusChanged || a.dateUpdated)).getTime();
            valB = new Date((b.status === Status.WORKED && b.completedDate) ? b.completedDate : (b.dateStatusChanged || b.dateUpdated)).getTime();
            break;
          default:
            valA = new Date(a[sortConfig.key as keyof Manuscript] as string || 0).getTime();
            valB = new Date(b[sortConfig.key as keyof Manuscript] as string || 0).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [manuscripts, filterStatus, search, dateRange, sortConfig]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(m => m.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  return {
    filterStatus, setFilterStatus,
    search, setSearch,
    selectedIds, setSelectedIds,
    showDateFilters, setShowDateFilters,
    dateRange, setDateRange,
    sortConfig, handleSort,
    filteredAndSorted,
    dailyStats,
    counts,
    handleSelectAll,
    handleSelectOne
  };
};
