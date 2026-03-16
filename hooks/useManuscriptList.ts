
import { useMemo, useState } from 'react';
import { Manuscript, Status } from '../types';

export const useManuscriptList = (manuscripts: Manuscript[], activeFilter: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER') => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(activeFilter);

  const filteredManuscripts = useMemo(() => {
    return manuscripts.filter(m => {
      let matchesStatus = true;
      if (filterStatus === 'PENDING_GROUP') {
        matchesStatus = [Status.PENDING, Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
      } else if (filterStatus === 'HANDOVER') {
        matchesStatus = m.status === Status.WORKED || m.status === Status.PENDING || m.status === Status.PENDING_JM;
      } else if (filterStatus !== 'ALL') {
        matchesStatus = m.status === filterStatus;
      }

      const searchTerm = search.toLowerCase();
      const matchesSearch = 
        m.manuscriptId.toLowerCase().includes(searchTerm) || 
        m.journalCode.toLowerCase().includes(searchTerm);

      return matchesStatus && matchesSearch;
    });
  }, [manuscripts, filterStatus, search]);

  const statusCounts = useMemo((): Record<Status, number> => {
    const counts: Record<Status, number> = {
      [Status.UNTOUCHED]: 0,
      [Status.WORKED]: 0,
      [Status.PENDING]: 0, // Fix: Added Status.PENDING
      [Status.PENDING_JM]: 0,
      [Status.PENDING_TL]: 0,
      [Status.PENDING_CED]: 0,
      [Status.BILLED]: 0
    };

    manuscripts.forEach(m => {
      if (counts[m.status] !== undefined) {
        counts[m.status]++;
      }
    });

    return counts;
  }, [manuscripts]);

  return {
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filteredManuscripts,
    statusCounts
  };
};
