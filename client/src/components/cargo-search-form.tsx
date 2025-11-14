import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

interface CargoSearchFormProps {
  onSubmit: (data: { selectedItemIds: number[] }) => void;
  isLoading?: boolean;
  onSelectionChange?: (data: { selectedBLs: string[]; selectedItemIds: number[] }) => void;
}

interface InboundItem {
  id: number;
  itemNo: string;
  blNo: string;
  품명: string;
}

export function CargoSearchForm({ onSubmit, isLoading, onSelectionChange }: CargoSearchFormProps) {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBLs, setSelectedBLs] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  // 마운트 시 sessionStorage에서 복원
  useEffect(() => {
    const savedCategory = sessionStorage.getItem('cargo-selected-category');
    const savedDate = sessionStorage.getItem('cargo-selected-date');
    const savedBLs = sessionStorage.getItem('cargo-selected-bls');
    const savedItems = sessionStorage.getItem('cargo-selected-items');
    if (savedCategory) setSelectedCategory(JSON.parse(savedCategory));
    if (savedDate) setSelectedDate(JSON.parse(savedDate));
    if (savedBLs) setSelectedBLs(JSON.parse(savedBLs));
    if (savedItems) setSelectedItemIds(JSON.parse(savedItems));
  }, []);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [blOpen, setBLOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);

  // 선택된 구분이 변경되면 sessionStorage에 저장
  useEffect(() => {
    sessionStorage.setItem('cargo-selected-category', JSON.stringify(selectedCategory));
  }, [selectedCategory]);

  // 선택된 날짜가 변경되면 sessionStorage에 저장
  useEffect(() => {
    sessionStorage.setItem('cargo-selected-date', JSON.stringify(selectedDate));
  }, [selectedDate]);

  // 선택된 B/L이 변경되면 sessionStorage에 저장
  useEffect(() => {
    sessionStorage.setItem('cargo-selected-bls', JSON.stringify(selectedBLs));
  }, [selectedBLs]);

  // 선택된 Item이 변경되면 sessionStorage에 저장
  useEffect(() => {
    sessionStorage.setItem('cargo-selected-items', JSON.stringify(selectedItemIds));
  }, [selectedItemIds]);

  // 구분 목록 가져오기 (DRY/WET) - 모든 사용자 데이터
  const { data: categoryList = [], isLoading: categoryLoading } = useQuery<string[]>({
    queryKey: ['/api/inbound/categories'],
    queryFn: async () => {
      const res = await fetch('/api/inbound/categories', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch category list');
      return res.json();
    },
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  // 반입일자 목록 가져오기 - 모든 사용자 데이터
  const { data: dateList = [], isLoading: dateLoading } = useQuery<string[]>({
    queryKey: ['/api/inbound/dates'],
    queryFn: async () => {
      const res = await fetch('/api/inbound/dates', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch date list');
      return res.json();
    },
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  // B/L 목록 가져오기 (구분 및 반입일자로 필터링) - 모든 사용자 데이터
  const { data: blList = [], isLoading: blLoading } = useQuery<string[]>({
    queryKey: ['/api/inbound/bl-list', { category: selectedCategory, date: selectedDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedDate) params.append('date', selectedDate);
      const url = params.toString() ? `/api/inbound/bl-list?${params.toString()}` : '/api/inbound/bl-list';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch BL list');
      return res.json();
    },
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  // 선택된 B/L들에 대응하는 Item No. 목록 가져오기 - 모든 사용자 데이터
  const { data: itemList = [], isLoading: itemsLoading } = useQuery<InboundItem[]>({
    queryKey: ['/api/inbound/items-by-bl', { blNos: selectedBLs.join(',') }],
    queryFn: async () => {
      const response = await fetch(`/api/inbound/items-by-bl?blNos=${selectedBLs.join(',')}`);
      if (!response.ok) throw new Error('Failed to fetch items');
      return response.json();
    },
    enabled: !!user && selectedBLs.length > 0,
    refetchOnWindowFocus: true,
  });

  // B/L 목록이 변경되면 선택된 B/L 중 존재하지 않는 것 제거 (로딩 중이 아닐 때만)
  useEffect(() => {
    // 로딩 중이면 초기화하지 않음 (hydration 보호)
    if (blLoading) return;
    
    if (selectedBLs.length > 0 && blList.length > 0) {
      const validBLs = selectedBLs.filter(bl => blList.includes(bl));
      if (validBLs.length !== selectedBLs.length) {
        setSelectedBLs(validBLs);
      }
    } else if (selectedBLs.length > 0 && blList.length === 0) {
      // B/L 목록이 완전히 비었으면 선택도 초기화
      setSelectedBLs([]);
    }
  }, [blList, blLoading]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setCategoryOpen(false);
    // 구분 변경 시 B/L과 Item 선택 초기화
    setSelectedBLs([]);
    setSelectedItemIds([]);
    onSelectionChange?.({ selectedBLs: [], selectedItemIds: [] });
    // B/L 목록 캐시 무효화하여 즉시 갱신
    queryClient.invalidateQueries({ queryKey: ['/api/inbound/bl-list'] });
    queryClient.invalidateQueries({ queryKey: ['/api/inbound/items-by-bl'] });
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setDateOpen(false);
    // 날짜 변경 시 B/L과 Item 선택 초기화
    setSelectedBLs([]);
    setSelectedItemIds([]);
    onSelectionChange?.({ selectedBLs: [], selectedItemIds: [] });
    // B/L 목록 캐시 무효화하여 즉시 갱신
    queryClient.invalidateQueries({ queryKey: ['/api/inbound/bl-list'] });
    queryClient.invalidateQueries({ queryKey: ['/api/inbound/items-by-bl'] });
  };

  const handleBLToggle = (bl: string) => {
    setSelectedBLs(prev => {
      const newBLs = prev.includes(bl)
        ? prev.filter(b => b !== bl)
        : [...prev, bl];
      onSelectionChange?.({ selectedBLs: newBLs, selectedItemIds: [] });
      return newBLs;
    });
    // B/L을 수동으로 변경할 때만 Item No. 초기화
    setSelectedItemIds([]);
  };

  const handleBLSelectAll = () => {
    const newBLs = selectedBLs.length === blList.length ? [] : [...blList];
    setSelectedBLs(newBLs);
    setSelectedItemIds([]);
    onSelectionChange?.({ selectedBLs: newBLs, selectedItemIds: [] });
  };

  const handleItemToggle = (itemId: number) => {
    setSelectedItemIds(prev => {
      const newIds = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      onSelectionChange?.({ selectedBLs, selectedItemIds: newIds });
      return newIds;
    });
  };

  const handleItemSelectAll = () => {
    const newIds = selectedItemIds.length === itemList.length ? [] : itemList.map(item => item.id);
    setSelectedItemIds(newIds);
    onSelectionChange?.({ selectedBLs, selectedItemIds: newIds });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemIds.length > 0) {
      onSubmit({ selectedItemIds });
    }
  };

  return (
    <div className="bg-slate-700 p-6">
      <h1 className="text-2xl font-bold text-white mb-4">화물진행정보 조회</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 구분 선택 드롭다운 */}
        <div className="space-y-2">
          <Label className="text-white font-medium">구분 선택</Label>
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={categoryOpen}
                data-testid="button-category-select"
                className="w-full justify-between bg-white text-foreground"
                disabled={isLoading || categoryLoading}
              >
                <span className="truncate">
                  {selectedCategory === null ? "구분을 선택하세요" : selectedCategory === "" ? "전체 구분" : selectedCategory}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandEmpty>구분이 없습니다.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-[150px]">
                    <CommandItem
                      value="all-categories"
                      onSelect={() => handleCategorySelect("")}
                      data-testid="option-category-all"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${selectedCategory === "" ? "opacity-100" : "opacity-0"}`}
                      />
                      전체 구분
                    </CommandItem>
                    {categoryList.map((category) => (
                      <CommandItem
                        key={category}
                        value={category}
                        onSelect={() => handleCategorySelect(category)}
                        data-testid={`option-category-${category}`}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${selectedCategory === category ? "opacity-100" : "opacity-0"}`}
                        />
                        {category}
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 반입일자 선택 드롭다운 */}
        <div className="space-y-2">
          <Label className="text-white font-medium">반입일자 선택</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={dateOpen}
                data-testid="button-date-select"
                className="w-full justify-between bg-white text-foreground"
                disabled={isLoading || dateLoading}
              >
                <span className="truncate">
                  {selectedDate === null ? "반입일자를 선택하세요" : selectedDate === "" ? "전체 날짜" : selectedDate}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="날짜 검색..." />
                <CommandEmpty>날짜가 없습니다.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-[200px]">
                    <CommandItem
                      value="all-dates"
                      onSelect={() => handleDateSelect("")}
                      data-testid="option-date-all"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${selectedDate === "" ? "opacity-100" : "opacity-0"}`}
                      />
                      전체 날짜
                    </CommandItem>
                    {dateList.map((date) => (
                      <CommandItem
                        key={date}
                        value={date}
                        onSelect={() => handleDateSelect(date)}
                        data-testid={`option-date-${date}`}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${selectedDate === date ? "opacity-100" : "opacity-0"}`}
                        />
                        {date}
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* B/L 선택 드롭다운 */}
        <div className="space-y-2">
          <Label className="text-white font-medium">B/L 번호 선택</Label>
          <Popover open={blOpen} onOpenChange={setBLOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={blOpen}
                data-testid="button-bl-select"
                className="w-full justify-between bg-white text-foreground"
                disabled={isLoading || blLoading || selectedDate === null}
              >
                <span className="truncate">
                  {selectedDate === null
                    ? "먼저 반입일자를 선택하세요"
                    : selectedBLs.length > 0
                    ? `${selectedBLs.length}개 선택됨`
                    : "B/L 번호를 선택하세요"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="B/L 번호 검색..." />
                <CommandEmpty>B/L 번호가 없습니다.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-[300px]">
                    <CommandItem
                      onSelect={handleBLSelectAll}
                      className="font-medium"
                      data-testid="item-bl-select-all"
                    >
                      <Checkbox
                        checked={selectedBLs.length === blList.length && blList.length > 0}
                        className="mr-2"
                      />
                      전체 선택 ({blList.length}개)
                    </CommandItem>
                    {blList.map((bl) => (
                      <CommandItem
                        key={bl}
                        onSelect={() => handleBLToggle(bl)}
                        data-testid={`item-bl-${bl}`}
                      >
                        <Checkbox
                          checked={selectedBLs.includes(bl)}
                          className="mr-2"
                        />
                        {bl}
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedBLs.length > 0 && (
            <div className="text-sm text-white/80 mt-2">
              선택된 B/L: {selectedBLs.join(', ')}
            </div>
          )}
        </div>

        {/* Item No. 선택 드롭다운 (캐스케이딩) */}
        <div className="space-y-2">
          <Label className="text-white font-medium">Item No. 선택</Label>
          <Popover open={itemOpen} onOpenChange={setItemOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={itemOpen}
                data-testid="button-item-select"
                className="w-full justify-between bg-white text-foreground"
                disabled={isLoading || itemsLoading || selectedBLs.length === 0}
              >
                <span className="truncate">
                  {selectedItemIds.length > 0
                    ? `${selectedItemIds.length}개 선택됨`
                    : selectedBLs.length === 0
                    ? "먼저 B/L을 선택하세요"
                    : "Item No.를 선택하세요"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Item No. 검색..." />
                <CommandEmpty>Item No.가 없습니다.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-[300px]">
                    <CommandItem
                      onSelect={handleItemSelectAll}
                      className="font-medium"
                      data-testid="item-select-all"
                    >
                      <Checkbox
                        checked={selectedItemIds.length === itemList.length && itemList.length > 0}
                        className="mr-2"
                      />
                      전체 선택 ({itemList.length}개)
                    </CommandItem>
                    {itemList.map((item) => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => handleItemToggle(item.id)}
                        data-testid={`item-${item.id}`}
                      >
                        <Checkbox
                          checked={selectedItemIds.includes(item.id)}
                          className="mr-2"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{item.itemNo}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.품명} (B/L: {item.blNo})
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedItemIds.length > 0 && (
            <div className="text-sm text-white/80 mt-2">
              선택된 항목: {itemList
                .filter(item => selectedItemIds.includes(item.id))
                .map(item => `${item.itemNo}(${item.blNo})`)
                .join(', ')}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            data-testid="button-search"
            disabled={isLoading || selectedItemIds.length === 0}
            className="w-full sm:w-auto min-h-[50px] px-6 font-bold"
          >
            <Search className="w-5 h-5 mr-2" />
            조회
          </Button>
        </div>
      </form>
    </div>
  );
}
