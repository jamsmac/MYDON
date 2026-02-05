import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { User, UserPlus, X, Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserSelectorProps {
  projectId: number;
  selectedUserId: number | null;
  onSelect: (userId: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

interface MemberUser {
  id: number;
  name: string | null;
  email: string | null;
  avatar: string | null;
}

export function UserSelector({ 
  projectId, 
  selectedUserId, 
  onSelect, 
  disabled = false,
  size = "md" 
}: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Fetch team members
  const { data: teamData, isLoading } = trpc.team.getMembers.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  
  // Get all members including owner
  const allMembers: MemberUser[] = [];
  if (teamData?.owner) {
    allMembers.push(teamData.owner);
  }
  if (teamData?.members) {
    teamData.members.forEach(m => {
      if (m.user) allMembers.push(m.user);
    });
  }
  
  // Filter members by search
  const filteredMembers = allMembers.filter(m => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(searchLower) ||
      m.email?.toLowerCase().includes(searchLower)
    );
  });
  
  // Get selected user info
  const selectedUser = allMembers.find(m => m.id === selectedUserId);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  // Generate avatar initials
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  // Generate color from name
  const getAvatarColor = (name: string | null) => {
    if (!name) return "bg-slate-600";
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500",
      "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500"
    ];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm"
  };
  
  const buttonSizeClasses = {
    sm: "h-7 px-2 text-xs",
    md: "h-9 px-3 text-sm"
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 transition-colors",
          buttonSizeClasses[size],
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-amber-500/50"
        )}
      >
        {selectedUser ? (
          <>
            <div className={cn(
              "rounded-full flex items-center justify-center text-white font-medium shrink-0",
              sizeClasses[size],
              getAvatarColor(selectedUser.name)
            )}>
              {selectedUser.avatar ? (
                <img 
                  src={selectedUser.avatar} 
                  alt={selectedUser.name || ""} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitials(selectedUser.name)
              )}
            </div>
            <span className="text-slate-200 truncate max-w-[100px]">
              {selectedUser.name || selectedUser.email}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="p-0.5 hover:bg-slate-600 rounded"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>
          </>
        ) : (
          <>
            <UserPlus className={cn(
              "text-slate-400",
              size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"
            )} />
            <span className="text-slate-400">Назначить</span>
          </>
        )}
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск участников..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
          </div>
          
          {/* Members list */}
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-sm">
                {search ? "Участники не найдены" : "Нет участников"}
              </div>
            ) : (
              <>
                {/* Unassign option */}
                {selectedUserId && (
                  <button
                    onClick={() => {
                      onSelect(null);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <X className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300">Снять назначение</p>
                    </div>
                  </button>
                )}
                
                {/* Members */}
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      onSelect(member.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 transition-colors text-left",
                      selectedUserId === member.id && "bg-amber-500/10"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-white font-medium shrink-0",
                      getAvatarColor(member.name)
                    )}>
                      {member.avatar ? (
                        <img 
                          src={member.avatar} 
                          alt={member.name || ""} 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(member.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {member.name || "Без имени"}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {member.email}
                      </p>
                    </div>
                    {selectedUserId === member.id && (
                      <Check className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact avatar display for task list
interface AssigneeAvatarProps {
  userId: number | null;
  projectId: number;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
}

export function AssigneeAvatar({ userId, projectId, size = "sm", showName = false }: AssigneeAvatarProps) {
  const { data: teamData } = trpc.team.getMembers.useQuery(
    { projectId },
    { enabled: !!projectId && !!userId }
  );
  
  if (!userId) return null;
  
  // Find user in team
  let user: MemberUser | null = null;
  if (teamData?.owner?.id === userId) {
    user = teamData.owner;
  } else {
    const member = teamData?.members?.find(m => m.userId === userId);
    if (member?.user) user = member.user;
  }
  
  if (!user) return null;
  
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  const getAvatarColor = (name: string | null) => {
    if (!name) return "bg-slate-600";
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500",
      "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500"
    ];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  const sizeClasses = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm"
  };
  
  return (
    <div className="flex items-center gap-1.5" title={user.name || user.email || undefined}>
      <div className={cn(
        "rounded-full flex items-center justify-center text-white font-medium shrink-0",
        sizeClasses[size],
        getAvatarColor(user.name)
      )}>
        {user.avatar ? (
          <img 
            src={user.avatar} 
            alt={user.name || ""} 
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          getInitials(user.name)
        )}
      </div>
      {showName && (
        <span className="text-xs text-slate-400 truncate max-w-[80px]">
          {user.name || user.email}
        </span>
      )}
    </div>
  );
}
