import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
  ADMIN_UID,
  MODULE_PERMISSIONS,
  normalizePermissions,
  createEmptyPermissions,
} from '../config/roles';
import { auth, db } from '../firebase/firebase';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SharedDatePicker from '../components/shared/SharedDatePicker';
import '../styles/admin-users.css';

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Wszystkie role' },
  { value: 'admin', label: 'Administrator' },
  { value: 'user', label: 'Użytkownik' },
];

function RoleFilterDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rootRef = useRef(null);
  const buttonRefs = useRef([]);
  const selected =
    ROLE_FILTER_OPTIONS.find((option) => option.value === value) ||
    ROLE_FILTER_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;

    const handleOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const openMenu = () => {
    const index = ROLE_FILTER_OPTIONS.findIndex(
      (option) => option.value === value
    );
    setFocusedIndex(Math.max(index, 0));
    setOpen(true);
  };

  const handleMenuKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = focusedIndex;
    if (event.key === 'ArrowDown')
      next = (focusedIndex + 1) % ROLE_FILTER_OPTIONS.length;
    if (event.key === 'ArrowUp')
      next =
        (focusedIndex - 1 + ROLE_FILTER_OPTIONS.length) %
        ROLE_FILTER_OPTIONS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = ROLE_FILTER_OPTIONS.length - 1;
    setFocusedIndex(next);
    buttonRefs.current[next]?.focus();
  };

  return (
    <div className="users-role-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`users-role-dropdown-trigger${open ? ' is-open' : ''}`}
        aria-label="Filtruj według roli"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span>{selected.label}</span>
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="users-role-dropdown-menu"
          role="listbox"
          aria-label="Wybierz rolę"
          onKeyDown={handleMenuKeyDown}
        >
          {ROLE_FILTER_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`users-role-dropdown-option${
                option.value === value ? ' is-selected' : ''
              }`}
              onFocus={() => setFocusedIndex(index)}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getInvitationDatePart(value) {
  return String(value || '').split('T')[0] || '';
}

function getInvitationTimePart(value) {
  return (
    String(value || '')
      .split('T')[1]
      ?.slice(0, 5) || '00:00'
  );
}

function setInvitationDatePart(previous, date) {
  return date ? `${date}T${getInvitationTimePart(previous)}` : '';
}

function setInvitationTimePart(previous, time) {
  const date = getInvitationDatePart(previous);
  return date ? `${date}T${time || '00:00'}` : '';
}

function InvitationTimePicker({ label, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const [hour = '00', minute = '00'] = String(value || '00:00').split(':');

  useEffect(() => {
    if (!open) return undefined;
    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    hourRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'center' });
    minuteRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'center' });
  }, [open]);

  return (
    <div className="users-invitation-time" ref={rootRef}>
      <span className="users-invitation-time-label">{label}</span>
      <button
        type="button"
        className={`users-time-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((previous) => !previous)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>
          {hour}:{minute}
        </span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="users-time-popover" role="dialog" aria-label={label}>
          <div className="users-time-popover-header">
            <span>Wybierz godzinę</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zamknij wybór godziny"
            >
              ×
            </button>
          </div>
          <div className="users-time-columns">
            <div className="users-time-column-wrap">
              <span>Godz.</span>
              <div
                className="users-time-column"
                ref={hourRef}
                role="listbox"
                aria-label="Godzina"
              >
                {Array.from({ length: 24 }, (_, index) =>
                  String(index).padStart(2, '0')
                ).map((item) => (
                  <button
                    type="button"
                    key={item}
                    role="option"
                    aria-selected={hour === item}
                    className={hour === item ? 'is-selected' : ''}
                    onClick={() => onChange(`${item}:${minute}`)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="users-time-column-wrap">
              <span>Min.</span>
              <div
                className="users-time-column"
                ref={minuteRef}
                role="listbox"
                aria-label="Minuty"
              >
                {Array.from({ length: 60 }, (_, index) =>
                  String(index).padStart(2, '0')
                ).map((item) => (
                  <button
                    type="button"
                    key={item}
                    role="option"
                    aria-selected={minute === item}
                    className={minute === item ? 'is-selected' : ''}
                    onClick={() => onChange(`${hour}:${item}`)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="users-time-popover-footer">
            <button
              type="button"
              onClick={() => {
                onChange('00:00');
                setOpen(false);
              }}
            >
              Wyczyść
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Gotowe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_USERS = {
  [ADMIN_UID]: {
    name: 'Administrator',
    email: '',
    role: 'admin',
  },
};

const ROLE_LABELS = {
  admin: 'Administrator',
  user: 'Użytkownik',
};

const ROLE_ICONS = {
  admin: '🛡️',
  user: '👤',
};

const MODULES = [
  {
    id: 'shopping',
    label: 'Lista zakupów',
    icon: '🛒',
  },
  {
    id: 'notifications',
    label: 'Powiadomienia',
    icon: '🔔',
  },
  {
    id: 'calendar',
    label: 'Kalendarz',
    icon: '📅',
  },
  {
    id: 'logs',
    label: 'Dziennik zdarzeń',
    icon: '📜',
  },
];

const ACTION_LABELS = {
  view: 'Podgląd',
  create: 'Dodawanie',
  edit: 'Edycja',
  delete: 'Usuwanie',
  takeOwn: 'Przejmowanie zgłoszeń na siebie',
  assign: 'Przypisywanie i przekazywanie zgłoszeń',
  changeStatus: 'Zmiana statusu zamówień',
  viewOwn: 'Podgląd własnych powiadomień',
  viewDetails: 'Podgląd szczegółów',
  editOwn: 'Edycja własnych wydarzeń',
};

const MODULE_ACTION_LABELS = {
  shopping: {
    view: 'Podgląd zgłoszeń',
    create: 'Dodawanie zgłoszeń',
    takeOwn: 'Przejmowanie nieprzypisanych zgłoszeń',
    assign: 'Przypisywanie i przekazywanie zgłoszeń',
    edit: 'Edycja zgłoszeń',
    delete: 'Usuwanie zgłoszeń',
    changeStatus: 'Zmiana statusu zamówień',
  },
  notifications: {
    viewOwn: 'Podgląd własnych powiadomień',
  },
  calendar: {
    view: 'Podgląd wydarzeń',
    create: 'Dodawanie wydarzeń',
    editOwn: 'Edycja własnych wydarzeń',
    delete: 'Usuwanie wydarzeń',
  },
  logs: {
    view: 'Podgląd dziennika zdarzeń',
  },
};

const VISIBLE_MODULE_ACTIONS = {
  shopping: [
    'view',
    'create',
    'takeOwn',
    'assign',
    'edit',
    'delete',
    'changeStatus',
  ],
  notifications: ['viewOwn'],
  calendar: ['view', 'create', 'editOwn', 'delete'],
  logs: ['view'],
};

function getActions(moduleId) {
  const allowed = MODULE_PERMISSIONS[moduleId] || [];
  return (VISIBLE_MODULE_ACTIONS[moduleId] || []).filter((action) =>
    allowed.includes(action)
  );
}

function cleanPermissions(permissions) {
  const normalized = normalizePermissions(permissions);
  return Object.fromEntries(
    MODULES.map((module) => [
      module.id,
      getActions(module.id).filter((action) =>
        (normalized[module.id] || []).includes(action)
      ),
    ])
  );
}

function createDefaultPermissions() {
  return createEmptyPermissions();
}

function toDate(value) {
  if (!value) return null;

  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLastLogin(value, language = 'pl') {
  const date = toDate(value);

  if (!date) return 'Brak danych';

  const locales = {
    pl: 'pl-PL',
    en: 'en-GB',
    uk: 'uk-UA',
  };

  return date.toLocaleString(locales[language] || 'pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRelativeLogin(value) {
  const date = toDate(value);

  if (!date) return 'Nie odnotowano logowania';

  const diff = Date.now() - date.getTime();

  if (diff < 0) return 'Ostatnie logowanie';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days === 1) return 'Wczoraj';
  if (days < 30) return `${days} dni temu`;

  return 'Dawniej';
}

function getErrorMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Podany adres e-mail jest nieprawidłowy.';
    case 'auth/too-many-requests':
      return 'Zbyt wiele prób. Spróbuj ponownie później.';
    case 'auth/operation-not-allowed':
      return 'Ta operacja nie jest włączona w Firebase.';
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Brak uprawnień w regułach Firestore.';
    case 'unavailable':
    case 'firestore/unavailable':
      return 'Brak połączenia z Firebase. Spróbuj ponownie.';
    default:
      return error?.message || 'Nie udało się wykonać operacji.';
  }
}

function getInvitationStatus(status) {
  switch (status) {
    case 'accepted':
      return 'Zaakceptowane';
    case 'cancelled':
      return 'Anulowane';
    case 'expired':
      return 'Wygasłe';
    default:
      return 'Oczekuje na aktywację';
  }
}

function getInvitationUrl(id) {
  return `${window.location.origin}/activate?invite=${encodeURIComponent(id)}`;
}

function PermissionsSelector({
  value,
  onToggle,
  onToggleFull,
  expandedModule,
  onExpand,
}) {
  return (
    <div className="users-permissions-grid">
      {MODULES.map((module) => {
        const actions = getActions(module.id);
        const selected = value[module.id] || [];
        const selectedCount = actions.filter((action) =>
          selected.includes(action)
        ).length;
        const fullAccess = selectedCount === actions.length;
        const isExpanded = expandedModule === module.id;
        return (
          <section
            key={module.id}
            className={`users-permission-module${
              isExpanded ? ' is-expanded' : ''
            }`}
          >
            <div className="users-permission-heading">
              <span className="users-permission-icon" aria-hidden="true">
                {module.icon}
              </span>
              <div className="users-permission-name">
                <strong>{module.label}</strong>
                <small>
                  {fullAccess
                    ? 'Pełny dostęp'
                    : selectedCount === 0
                    ? 'Brak dostępu'
                    : `${selectedCount} z ${actions.length} uprawnień`}
                </small>
              </div>
              <label className="users-permission-full">
                <input
                  type="checkbox"
                  checked={fullAccess}
                  onChange={(event) =>
                    onToggleFull(module.id, event.target.checked)
                  }
                />
                <span>Pełny dostęp</span>
              </label>
              <button
                type="button"
                className="users-permission-expand"
                onClick={() => onExpand(isExpanded ? null : module.id)}
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded ? `Zwiń ${module.label}` : `Rozwiń ${module.label}`
                }
              >
                {isExpanded ? '⌃' : '⌄'}
              </button>
            </div>
            {isExpanded && (
              <div className="users-permission-options">
                {actions.map((action) => (
                  <label key={action} className="users-permission-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(action)}
                      onChange={() => onToggle(module.id, action)}
                    />
                    <span>
                      {MODULE_ACTION_LABELS[module.id]?.[action] ||
                        ACTION_LABELS[action] ||
                        action}
                    </span>
                  </label>
                ))}
                {module.id === 'shopping' && (
                  <small className="users-permission-hint">
                    Dodawanie zgłoszeń wymaga przydzielonego uprawnienia.
                  </small>
                )}
                {module.id === 'notifications' && (
                  <small className="users-permission-hint">
                    Oznaczanie jako przeczytane jest automatycznie dostępne przy
                    podglądzie własnych powiadomień.
                  </small>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function getUsedCount(invitation) {
  const value = Number(
    invitation.usedCount ?? (invitation.status === 'accepted' ? 1 : 0)
  );
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getMaxUses(invitation) {
  if (invitation.maxUses === null) return null;
  const value = Number(invitation.maxUses ?? 1);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function getEffectiveInvitationStatus(invitation, now) {
  if (invitation.status === 'cancelled') return 'Anulowane';
  if (invitation.status === 'expired') return 'Wygasłe';
  const maxUses = getMaxUses(invitation);
  if (maxUses !== null && getUsedCount(invitation) >= maxUses)
    return 'Wykorzystane';
  const expiresAt = toDate(invitation.expiresAt);
  if (expiresAt && expiresAt.getTime() <= now) return 'Wygasłe';
  const startsAt = toDate(invitation.startsAt);
  if (startsAt && startsAt.getTime() > now) return 'Zaplanowane';
  return invitation.status === 'pending'
    ? 'Aktywne'
    : getInvitationStatus(invitation.status);
}

function isInvitationActive(invitation, now) {
  return getEffectiveInvitationStatus(invitation, now) === 'Aktywne';
}

function formatInvitationDate(value) {
  const date = toDate(value);
  return date
    ? date.toLocaleString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'bez ograniczenia';
}

export default function UsersPage() {
  const { t, i18n } = useTranslation();

  const [users, setUsers] = useState({});
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusTarget, setStatusTarget] = useState(null);
  const [changingStatusUid, setChangingStatusUid] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [usersListExpanded, setUsersListExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [invitationLimit, setInvitationLimit] = useState('1');
  const [unlimitedInvitations, setUnlimitedInvitations] = useState(false);
  const [invitationStartsAt, setInvitationStartsAt] = useState('');
  const [invitationEndsAt, setInvitationEndsAt] = useState('');
  const [expandedModule, setExpandedModule] = useState('shopping');
  const [editingUser, setEditingUser] = useState(null);
  const [editingFirstName, setEditingFirstName] = useState('');
  const [editingLastName, setEditingLastName] = useState('');
  const [editingPermissions, setEditingPermissions] = useState(
    createEmptyPermissions
  );
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resettingUid, setResettingUid] = useState(null);
  const [deletingUserUid, setDeletingUserUid] = useState(null);
  const [deletingInvitationId, setDeletingInvitationId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState(null);
  const [createdInvitation, setCreatedInvitation] = useState(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState(null);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const currentUserIsAdmin = auth.currentUser?.uid === ADMIN_UID;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const data = {};

        snapshot.forEach((document) => {
          data[document.id] = document.data();
        });

        setUsers(data);
        setLoading(false);
      },
      (error) => {
        console.error('Błąd pobierania użytkowników:', error);

        setNotice({
          type: 'error',
          message: 'Nie udało się pobrać listy użytkowników.',
        });

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUserIsAdmin) {
      setInvitationsLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'userInvitations'),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        data.sort((a, b) => {
          const dateA = toDate(a.createdAt)?.getTime() || 0;
          const dateB = toDate(b.createdAt)?.getTime() || 0;

          return dateB - dateA;
        });

        setInvitations(data);
        setInvitationsLoading(false);
      },
      (error) => {
        console.error('Błąd pobierania zaproszeń:', error);

        setNotice({
          type: 'error',
          message: 'Nie udało się pobrać zaproszeń.',
        });

        setInvitationsLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUserIsAdmin]);

  const userList = useMemo(() => {
    const ids = new Set([...Object.keys(DEFAULT_USERS), ...Object.keys(users)]);

    return Array.from(ids).map((uid) => {
      const defaults = DEFAULT_USERS[uid] || {};
      const data = users[uid] || {};

      const role = uid === ADMIN_UID ? 'admin' : 'user';

      return {
        uid,
        name:
          defaults.name ||
          data.displayName ||
          data.name ||
          [data.firstName, data.lastName].filter(Boolean).join(' ') ||
          data.email?.split('@')[0] ||
          'Użytkownik',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || defaults.email || '',
        role,
        lastLoginAt: data.lastLoginAt || null,
        permissions: data.permissions || {},
        status:
          data.status || (uid === ADMIN_UID ? 'active' : 'pending_approval'),
      };
    });
  }, [users]);

  const activeUsers = useMemo(
    () => userList.filter((user) => user.status === 'active'),
    [userList]
  );

  const listedUsers = useMemo(
    () =>
      userList.filter(
        (user) => user.status === 'active' || user.status === 'blocked'
      ),
    [userList]
  );

  const blockedUsersCount = useMemo(
    () => listedUsers.filter((user) => user.status === 'blocked').length,
    [listedUsers]
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return listedUsers.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.uid.toLowerCase().includes(query);

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      const matchesStatus =
        statusFilter === 'all' || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [listedUsers, search, roleFilter, statusFilter]);

  const pendingUsers = useMemo(
    () =>
      userList.filter(
        (user) => user.role === 'user' && user.status === 'pending_approval'
      ),
    [userList]
  );

  const recentLogins = useMemo(() => {
    const now = Date.now();

    return activeUsers.filter((user) => {
      const date = toDate(user.lastLoginAt);

      return (
        date && now - date.getTime() >= 0 && now - date.getTime() < 7 * 86400000
      );
    }).length;
  }, [activeUsers]);

  const activeInvitations = useMemo(
    () =>
      invitations.filter((invitation) => isInvitationActive(invitation, clock)),
    [invitations, clock]
  );

  const archivedInvitations = useMemo(
    () =>
      invitations.filter(
        (invitation) => !isInvitationActive(invitation, clock)
      ),
    [invitations, clock]
  );

  const updateModulePermission = (setter, moduleId, actionId) => {
    setter((previous) => {
      const current = previous[moduleId] || [];
      const next = current.includes(actionId)
        ? current.filter((action) => action !== actionId)
        : [...current, actionId];
      return cleanPermissions({ ...previous, [moduleId]: next });
    });
  };

  const updateFullModule = (setter, moduleId, checked) => {
    setter((previous) =>
      cleanPermissions({
        ...previous,
        [moduleId]: checked ? getActions(moduleId) : [],
      })
    );
  };

  const openPermissionsEditor = (user) => {
    if (!currentUserIsAdmin || user.uid === ADMIN_UID) return;
    setEditingUser(user);
    const parts = user.name.trim().split(/\s+/);
    setEditingFirstName(user.firstName || parts[0] || '');
    setEditingLastName(
      user.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : '')
    );
    setEditingPermissions(cleanPermissions(user.permissions));
    setExpandedModule('shopping');
    setNotice(null);
  };

  const handleSavePermissions = async (event) => {
    event.preventDefault();
    if (!currentUserIsAdmin || !editingUser || editingUser.uid === ADMIN_UID)
      return;
    const firstName = editingFirstName.trim().replace(/\s+/g, ' ');
    const lastName = editingLastName.trim().replace(/\s+/g, ' ');
    if (!firstName || !lastName) {
      setNotice({
        type: 'error',
        message: 'Podaj imię i nazwisko użytkownika.',
      });
      return;
    }
    if (firstName.length > 100 || lastName.length > 100) {
      setNotice({
        type: 'error',
        message: 'Imię i nazwisko mogą mieć maksymalnie po 100 znaków.',
      });
      return;
    }
    if (
      editingUser.status === 'pending_approval' &&
      !Object.values(cleanPermissions(editingPermissions)).some(
        (actions) => actions.length
      )
    ) {
      setNotice({
        type: 'error',
        message:
          'Przed zatwierdzeniem konta przydziel przynajmniej jedno uprawnienie.',
      });
      return;
    }
    const displayName = `${firstName} ${lastName}`;
    setSavingPermissions(true);
    setNotice(null);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        firstName,
        lastName,
        name: displayName,
        displayName,
        permissions: cleanPermissions(editingPermissions),
        ...(editingUser.status === 'pending_approval'
          ? { status: 'active' }
          : {}),
      });
      setNotice({
        type: 'success',
        message: `Zapisano dane i uprawnienia użytkownika ${displayName}.`,
      });
      setEditingUser(null);
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleApproval = async (user, approved) => {
    if (!currentUserIsAdmin || user.uid === ADMIN_UID) return;
    setSavingPermissions(true);
    setNotice(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: approved ? 'active' : 'rejected',
        permissions: approved
          ? cleanPermissions(editingPermissions)
          : createEmptyPermissions(),
      });
      setEditingUser(null);
      setNotice({
        type: 'success',
        message: approved
          ? `Zatwierdzono konto ${user.name}.`
          : `Odrzucono prośbę ${user.name}.`,
      });
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSavingPermissions(false);
    }
  };

  const resetAddForm = () => {
    setInvitationLimit('1');
    setUnlimitedInvitations(false);
    setInvitationStartsAt('');
    setInvitationEndsAt('');
  };

  const handleResetPassword = async (user) => {
    if (!currentUserIsAdmin) return;

    if (!user.email) {
      setNotice({
        type: 'error',
        message: 'Ten użytkownik nie ma przypisanego adresu e-mail.',
      });
      return;
    }

    setResettingUid(user.uid);
    setNotice(null);

    try {
      await sendPasswordResetEmail(auth, user.email);

      setNotice({
        type: 'success',
        message: `Zlecono wysłanie wiadomości resetującej hasło na adres ${user.email}.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: getErrorMessage(error),
      });
    } finally {
      setResettingUid(null);
    }
  };

  const requestChangeStatus = (user) => {
    if (
      !currentUserIsAdmin ||
      !user?.uid ||
      user.uid === ADMIN_UID ||
      user.uid === auth.currentUser?.uid
    )
      return;
    if (user.status !== 'active' && user.status !== 'blocked') return;
    setStatusError('');
    setStatusTarget(user);
  };

  const confirmChangeStatus = async () => {
    if (!currentUserIsAdmin || !statusTarget || changingStatusUid) return;
    const user = statusTarget;
    if (user.uid === ADMIN_UID || user.uid === auth.currentUser?.uid) return;
    const nextStatus = user.status === 'blocked' ? 'active' : 'blocked';
    setChangingStatusUid(user.uid);
    setStatusError('');
    setNotice(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: nextStatus,
        statusChangedAt: serverTimestamp(),
        statusChangedBy: auth.currentUser.uid,
      });
      setNotice({
        type: 'success',
        message:
          nextStatus === 'blocked'
            ? `Zablokowano konto ${user.name}. Dane i historia zostały zachowane.`
            : `Odblokowano konto ${user.name}.`,
      });
      setStatusTarget(null);
    } catch (error) {
      setStatusError(getErrorMessage(error));
    } finally {
      setChangingStatusUid(null);
    }
  };

  const requestDeleteInvitation = (invitation) => {
    if (!currentUserIsAdmin || !invitation?.id) return;
    setDeleteError('');
    setDeleteTarget({ type: 'invitation', item: invitation });
  };

  const requestDeleteUser = (user) => {
    if (!currentUserIsAdmin || !user?.uid) return;

    if (user.uid === ADMIN_UID || user.uid === auth.currentUser?.uid) {
      setNotice({
        type: 'error',
        message: 'Nie można usunąć konta administratora ani konta systemowego.',
      });
      return;
    }

    setDeleteError('');
    setDeleteTarget({ type: 'user', item: user });
  };

  const closeDeleteDialog = () => {
    if (deletingUserUid !== null || deletingInvitationId !== null) return;
    setDeleteTarget(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (
      !deleteTarget ||
      deletingUserUid !== null ||
      deletingInvitationId !== null
    )
      return;
    if (!currentUserIsAdmin) {
      setDeleteError('Brak uprawnień do wykonania tej operacji.');
      return;
    }

    const { type, item } = deleteTarget;
    setDeleteError('');
    setNotice(null);

    if (type === 'invitation') {
      if (!item?.id) return;
      setDeletingInvitationId(item.id);
      try {
        await deleteDoc(doc(db, 'userInvitations', item.id));
        if (createdInvitation?.id === item.id) setCreatedInvitation(null);
        setNotice({
          type: 'success',
          message: 'Zaproszenie zostało usunięte.',
        });
        setDeleteTarget(null);
      } catch (error) {
        setDeleteError(getErrorMessage(error));
      } finally {
        setDeletingInvitationId(null);
      }
      return;
    }

    if (type === 'user') {
      if (
        !item?.uid ||
        item.uid === ADMIN_UID ||
        item.uid === auth.currentUser?.uid
      ) {
        setDeleteError('Nie można usunąć tego konta.');
        return;
      }
      setDeletingUserUid(item.uid);
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', item.uid));
        await batch.commit();
        setNotice({
          type: 'success',
          message: `Usunięto profil ${item.name} i odebrano dostęp do LS Zakupy. Konto Firebase Authentication nadal istnieje.`,
        });
        setDeleteTarget(null);
      } catch (error) {
        setDeleteError(getErrorMessage(error));
      } finally {
        setDeletingUserUid(null);
      }
    }
  };

  const handleAddUser = async (event) => {
    event.preventDefault();

    if (!currentUserIsAdmin || !auth.currentUser) {
      setNotice({
        type: 'error',
        message: 'Tylko administrator może tworzyć zaproszenia.',
      });
      return;
    }

    const limit = Number(invitationLimit);
    if (
      !unlimitedInvitations &&
      (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000)
    ) {
      setNotice({
        type: 'error',
        message: 'Podaj limit od 1 do 10000 wykorzystań.',
      });
      return;
    }

    const startsAt = invitationStartsAt ? new Date(invitationStartsAt) : null;
    const endsAt = invitationEndsAt ? new Date(invitationEndsAt) : null;

    if (
      (startsAt && Number.isNaN(startsAt.getTime())) ||
      (endsAt && Number.isNaN(endsAt.getTime()))
    ) {
      setNotice({ type: 'error', message: 'Wprowadź poprawne daty ważności.' });
      return;
    }
    if (startsAt && endsAt && startsAt >= endsAt) {
      setNotice({
        type: 'error',
        message: 'Data końcowa musi być późniejsza niż początkowa.',
      });
      return;
    }
    if (endsAt && endsAt.getTime() <= Date.now()) {
      setNotice({
        type: 'error',
        message: 'Data końcowa musi być w przyszłości.',
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const reference = await addDoc(collection(db, 'userInvitations'), {
        role: 'user',
        permissions: createDefaultPermissions(),
        status: 'pending',
        maxUses: unlimitedInvitations ? null : limit,
        usedCount: 0,
        startsAt: startsAt || null,
        expiresAt: endsAt || null,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        acceptedAt: null,
        acceptedBy: null,
      });

      setCreatedInvitation({
        id: reference.id,
        url: getInvitationUrl(reference.id),
      });
      setShowAddModal(false);
      resetAddForm();
      setNotice({
        type: 'success',
        message:
          'Zaproszenie utworzono. Skopiuj link i przekaż go osobom, które mają się zarejestrować.',
      });
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const copyInvitationLink = async (invitation) => {
    const url = getInvitationUrl(invitation.id);

    try {
      await navigator.clipboard.writeText(url);

      setCopiedInvitationId(invitation.id);

      setNotice({
        type: 'success',
        message:
          'Skopiowano link zaproszenia. ' +
          'Link jest gotowy do przekazania użytkownikowi.',
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: 'Nie udało się skopiować linku.',
      });
    }
  };

  const closeModal = () => {
    if (submitting) return;

    setShowAddModal(false);
  };

  return (
    <section className="users-page">
      <ConfirmDialog
        open={Boolean(statusTarget)}
        variant={statusTarget?.status === 'blocked' ? 'default' : 'danger'}
        title={
          statusTarget?.status === 'blocked'
            ? 'Odblokować użytkownika?'
            : 'Zablokować użytkownika?'
        }
        message={
          statusTarget?.status === 'blocked'
            ? `Czy odblokować konto „${
                statusTarget?.name || ''
              }”? Użytkownik odzyska dostęp zgodnie z przydzielonymi uprawnieniami.`
            : `Czy zablokować konto „${
                statusTarget?.name || ''
              }”? Użytkownik utraci dostęp do funkcji wymagających aktywnego konta. Jego dane, przypisania i historia zamówień pozostaną zapisane.`
        }
        confirmText={
          statusTarget?.status === 'blocked'
            ? 'Odblokuj konto'
            : 'Zablokuj konto'
        }
        cancelText="Anuluj"
        loading={changingStatusUid !== null}
        onConfirm={confirmChangeStatus}
        onCancel={() => {
          if (!changingStatusUid) {
            setStatusTarget(null);
            setStatusError('');
          }
        }}
      >
        {statusError && (
          <p
            role="alert"
            style={{ marginTop: 12, color: '#ff9297', fontSize: '0.85rem' }}
          >
            {statusError}
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="danger"
        title={
          deleteTarget?.type === 'user'
            ? 'Usunąć użytkownika?'
            : 'Usunąć zaproszenie?'
        }
        message={
          deleteTarget?.type === 'user'
            ? `Czy na pewno chcesz usunąć użytkownika „${
                deleteTarget.item.name
              }” (${
                deleteTarget.item.email || deleteTarget.item.uid
              })? Utraci dostęp do LS Zakupy. Konto Firebase Authentication pozostanie i wymaga osobnego usunięcia przez administratora Firebase.`
            : `Czy na pewno chcesz usunąć zaproszenie dla „${
                deleteTarget?.item?.email ||
                deleteTarget?.item?.name ||
                deleteTarget?.item?.id ||
                'zaproszenia'
              }”? Tej operacji nie można cofnąć.`
        }
        confirmText={
          deleteTarget?.type === 'user'
            ? 'Usuń użytkownika'
            : 'Usuń zaproszenie'
        }
        cancelText="Anuluj"
        loading={deletingUserUid !== null || deletingInvitationId !== null}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      >
        {deleteError && (
          <p
            role="alert"
            style={{ marginTop: 12, color: '#ff9297', fontSize: '0.85rem' }}
          >
            {deleteError}
          </p>
        )}
      </ConfirmDialog>
      <header className="users-page-header">
        <div className="users-page-header-content">
          <span className="dashboard-eyebrow">ADMINISTRACJA</span>

          <h2>Użytkownicy</h2>

          <p>
            Zarządzaj dostępem do systemu, przygotowuj zaproszenia, sprawdzaj
            ostatnie logowania i uprawnienia użytkowników.
          </p>
        </div>

        {currentUserIsAdmin && (
          <button
            type="button"
            className="users-add-button"
            onClick={() => {
              setNotice(null);
              setShowAddModal(true);
            }}
          >
            <span aria-hidden="true">＋</span>
            Dodaj użytkownika
          </button>
        )}
      </header>

      {notice && (
        <div
          className={`users-notice ${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          <span aria-hidden="true">
            {notice.type === 'success' ? '✓' : '!'}
          </span>

          <p>{notice.message}</p>

          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Zamknij komunikat"
          >
            ×
          </button>
        </div>
      )}

      {createdInvitation && (
        <div className="users-panel">
          <div className="users-panel-heading">
            <div>
              <h3>Przygotowane zaproszenie</h3>
              <p>Link do nowego zaproszenia</p>
            </div>

            <span className="users-count">Oczekuje</span>
          </div>

          <div className="users-modal-info">
            Link może zostać przekazany osobom rejestrującym się w systemie.
            Limity muszą być dodatkowo sprawdzane podczas aktywacji konta.
          </div>

          <div className="users-filters">
            <input
              type="text"
              value={createdInvitation.url}
              readOnly
              aria-label="Link zaproszenia"
              style={{
                width: '100%',
                minWidth: 0,
                minHeight: 46,
                padding: '12px 14px',
                border: '1px solid var(--input-border)',
                borderRadius: 12,
                background: 'var(--input-background)',
                color: 'var(--text)',
              }}
            />

            <button
              type="button"
              className="user-reset-button"
              onClick={() => copyInvitationLink(createdInvitation)}
            >
              📋 Kopiuj link
            </button>
          </div>
        </div>
      )}

      <div className="users-stats">
        <div className="users-stat-card">
          <div className="users-stat-icon" aria-hidden="true">
            👥
          </div>

          <div>
            <span>Aktywne konta</span>
            <strong>{activeUsers.length}</strong>
          </div>
        </div>

        <div className="users-stat-card">
          <div className="users-stat-icon" aria-hidden="true">
            🛡️
          </div>

          <div>
            <span>Administratorzy</span>
            <strong>
              {activeUsers.filter((user) => user.role === 'admin').length}
            </strong>
          </div>
        </div>

        <div className="users-stat-card">
          <div className="users-stat-icon" aria-hidden="true">
            🕒
          </div>

          <div>
            <span>Logowanie w ciągu 7 dni</span>
            <strong>{recentLogins}</strong>
          </div>
        </div>
      </div>

      <div className="users-panel">
        <div className="users-panel-heading">
          <div>
            <h3>Lista pracowników</h3>
            <p>
              Aktywne konta, ostatnie logowania i zarządzanie uprawnieniami.
            </p>
          </div>

          <button
            type="button"
            className="user-reset-button"
            onClick={() => setUsersListExpanded((previous) => !previous)}
            aria-expanded={usersListExpanded}
            aria-controls="users-list-content"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
          >
            <span className="users-count">
              {filteredUsers.length} z {listedUsers.length}
            </span>
            <span aria-hidden="true">{usersListExpanded ? '⌃' : '⌄'}</span>
            <span>{usersListExpanded ? 'Zwiń listę' : 'Rozwiń listę'}</span>
          </button>
        </div>

        {usersListExpanded && (
          <div id="users-list-content">
            <div className="users-filters">
              <label className="users-search">
                <span className="users-search-icon" aria-hidden="true">
                  ⌕
                </span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Szukaj użytkownika lub e-maila..."
                  aria-label="Szukaj użytkownika"
                />
              </label>

              <RoleFilterDropdown value={roleFilter} onChange={setRoleFilter} />
            </div>
            <div
              className="users-status-filters"
              role="group"
              aria-label="Filtruj według statusu konta"
            >
              {[
                {
                  value: 'all',
                  label: 'Wszystkie konta',
                  count: listedUsers.length,
                },
                {
                  value: 'active',
                  label: 'Aktywne',
                  count: activeUsers.length,
                },
                {
                  value: 'blocked',
                  label: 'Zablokowane',
                  count: blockedUsersCount,
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`users-status-filter${
                    statusFilter === option.value ? ' is-active' : ''
                  }`}
                  aria-pressed={statusFilter === option.value}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label} <span>{option.count}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="users-empty">
                {t('admin.dashboard.loading', 'Ładowanie...')}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="users-empty">
                Nie znaleziono użytkowników pasujących do filtrów.
              </div>
            ) : (
              <div className="users-list">
                {filteredUsers.map((user) => (
                  <article
                    className={`user-card${
                      user.status === 'blocked' ? ' is-blocked' : ''
                    }`}
                    key={user.uid}
                  >
                    <div className="user-card-avatar" aria-hidden="true">
                      {ROLE_ICONS[user.role] || '👤'}
                    </div>

                    <div className="user-card-main">
                      <div className="user-card-title">
                        <h3>{user.name}</h3>

                        <span
                          className={`user-role ${
                            user.status === 'blocked' ? 'blocked' : user.role
                          }`}
                        >
                          {user.status === 'blocked'
                            ? 'Zablokowany'
                            : user.status === 'pending_approval'
                            ? 'Oczekuje na akceptację'
                            : user.status === 'rejected'
                            ? 'Odrzucony'
                            : ROLE_LABELS[user.role] || 'Użytkownik'}
                        </span>
                      </div>

                      <p className="user-card-email">
                        {user.email || 'Brak adresu e-mail'}
                      </p>

                      <div className="user-card-uid">
                        <span>UID</span>
                        <code title={user.uid}>{user.uid}</code>
                      </div>
                    </div>

                    <div className="user-card-side">
                      <div className="user-card-login">
                        <span className="user-card-login-label">
                          Ostatnie logowanie
                        </span>

                        <strong>
                          {formatLastLogin(user.lastLoginAt, i18n.language)}
                        </strong>

                        <small>{getRelativeLogin(user.lastLoginAt)}</small>
                      </div>

                      {currentUserIsAdmin && user.role === 'user' && (
                        <button
                          type="button"
                          className="user-reset-button"
                          onClick={() => openPermissionsEditor(user)}
                        >
                          ⚙️ Edytuj dane i uprawnienia
                        </button>
                      )}

                      {currentUserIsAdmin && (
                        <button
                          type="button"
                          className="user-reset-button"
                          onClick={() => handleResetPassword(user)}
                          disabled={resettingUid === user.uid || !user.email}
                        >
                          <span aria-hidden="true">🔑</span>

                          {resettingUid === user.uid
                            ? 'Wysyłanie...'
                            : 'Resetuj hasło'}
                        </button>
                      )}

                      {currentUserIsAdmin && user.role === 'user' && (
                        <button
                          type="button"
                          className={`user-reset-button users-status-action ${
                            user.status === 'blocked'
                              ? 'is-unblock'
                              : 'is-block'
                          }`}
                          onClick={() => requestChangeStatus(user)}
                          disabled={changingStatusUid === user.uid}
                        >
                          {changingStatusUid === user.uid
                            ? 'Zapisywanie...'
                            : user.status === 'blocked'
                            ? '🔓 Odblokuj użytkownika'
                            : '🔒 Zablokuj użytkownika'}
                        </button>
                      )}

                      {currentUserIsAdmin && user.role === 'user' && (
                        <button
                          type="button"
                          className="user-reset-button"
                          style={{ color: '#dc2626', borderColor: '#dc2626' }}
                          onClick={() => requestDeleteUser(user)}
                          disabled={deletingUserUid === user.uid}
                        >
                          {deletingUserUid === user.uid
                            ? 'Usuwanie...'
                            : '🗑️ Usuń użytkownika'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {currentUserIsAdmin && (
        <div className="users-panel">
          <div className="users-panel-heading">
            <div>
              <h3>Prośby o rejestrację konta</h3>
              <p>
                Zweryfikowane konta oczekujące na Twoją decyzję. Przed
                zatwierdzeniem wybierz uprawnienia.
              </p>
            </div>
            <span className="users-count">
              {pendingUsers.length} oczekujących
            </span>
          </div>
          {pendingUsers.length === 0 ? (
            <div className="users-empty">Brak próśb o zatwierdzenie.</div>
          ) : (
            <div className="users-list">
              {pendingUsers.map((user) => (
                <article className="user-card" key={user.uid}>
                  <div className="user-card-avatar">👤</div>
                  <div className="user-card-main">
                    <div className="user-card-title">
                      <h3>{user.name}</h3>
                      <span className="user-role">Oczekuje</span>
                    </div>
                    <p className="user-card-email">{user.email}</p>
                  </div>
                  <div className="user-card-side">
                    <button
                      type="button"
                      className="user-reset-button"
                      onClick={() => openPermissionsEditor(user)}
                    >
                      Przydziel uprawnienia i zatwierdź
                    </button>
                    <button
                      type="button"
                      className="user-reset-button users-reject-button"
                      disabled={savingPermissions}
                      onClick={() => handleApproval(user, false)}
                    >
                      Odrzuć prośbę
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {currentUserIsAdmin && (
        <div className="users-panel">
          <div className="users-panel-heading">
            <div>
              <h3>Aktywne zaproszenia</h3>
              <p>
                Zaproszenia dostępne w wyznaczonym okresie i z wolnymi
                wykorzystaniami.
              </p>
            </div>
            <span className="users-count">
              {activeInvitations.length} aktywnych
            </span>
          </div>
          {invitationsLoading ? (
            <div className="users-empty">Ładowanie zaproszeń...</div>
          ) : activeInvitations.length === 0 ? (
            <div className="users-empty">Brak aktywnych zaproszeń.</div>
          ) : (
            <div className="users-list">
              {activeInvitations.map((invitation) => (
                <article className="user-card" key={invitation.id}>
                  <div className="user-card-avatar" aria-hidden="true">
                    ✉️
                  </div>
                  <div className="user-card-main">
                    <div className="user-card-title">
                      <h3>
                        {invitation.name ||
                          invitation.email ||
                          'Zaproszenie ogólne'}
                      </h3>
                      <span className="user-role">Aktywne</span>
                    </div>
                    <p className="user-card-email">
                      Wykorzystania: {getUsedCount(invitation)} /{' '}
                      {getMaxUses(invitation) ?? 'bez limitu'}
                    </p>
                    <small>
                      Ważne od: {formatInvitationDate(invitation.startsAt)} ·
                      Ważne do: {formatInvitationDate(invitation.expiresAt)}
                    </small>
                  </div>
                  <div className="user-card-side">
                    <button
                      type="button"
                      className="user-reset-button"
                      onClick={() => copyInvitationLink(invitation)}
                    >
                      📋{' '}
                      {copiedInvitationId === invitation.id
                        ? 'Skopiowano'
                        : 'Kopiuj link'}
                    </button>
                    <button
                      type="button"
                      className="user-reset-button"
                      onClick={() => requestDeleteInvitation(invitation)}
                      disabled={deletingInvitationId === invitation.id}
                    >
                      🗑️ Usuń zaproszenie
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {archivedInvitations.length > 0 && (
            <details className="users-invitation-history">
              <summary>
                Historia zaproszeń ({archivedInvitations.length})
              </summary>
              <div className="users-list">
                {archivedInvitations.map((invitation) => (
                  <article className="user-card" key={invitation.id}>
                    <div className="user-card-avatar" aria-hidden="true">
                      📁
                    </div>
                    <div className="user-card-main">
                      <div className="user-card-title">
                        <h3>
                          {invitation.name ||
                            invitation.email ||
                            'Zaproszenie ogólne'}
                        </h3>
                        <span className="user-role">
                          {getEffectiveInvitationStatus(invitation, clock)}
                        </span>
                      </div>
                      <p className="user-card-email">
                        Wykorzystania: {getUsedCount(invitation)} /{' '}
                        {getMaxUses(invitation) ?? 'bez limitu'}
                      </p>
                      <small>
                        Ważne do: {formatInvitationDate(invitation.expiresAt)}
                      </small>
                    </div>
                    <div className="user-card-side">
                      <button
                        type="button"
                        className="user-reset-button"
                        onClick={() => requestDeleteInvitation(invitation)}
                        disabled={deletingInvitationId === invitation.id}
                      >
                        🗑️ Usuń z historii
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {editingUser && (
        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingPermissions)
              setEditingUser(null);
          }}
        >
          <div
            className="users-modal users-permissions-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-permissions-title"
          >
            <div className="users-modal-header">
              <div>
                <span className="users-modal-eyebrow">
                  DANE I UPRAWNIENIA UŻYTKOWNIKA
                </span>
                <h3 id="edit-permissions-title">{editingUser.name}</h3>
                <p>{editingUser.email}</p>
              </div>
              <button
                type="button"
                className="users-modal-close"
                onClick={() => setEditingUser(null)}
                disabled={savingPermissions}
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <form className="users-modal-form" onSubmit={handleSavePermissions}>
              <label>
                Imię
                <input
                  type="text"
                  value={editingFirstName}
                  onChange={(event) => setEditingFirstName(event.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  required
                  disabled={savingPermissions}
                />
              </label>
              <label>
                Nazwisko
                <input
                  type="text"
                  value={editingLastName}
                  onChange={(event) => setEditingLastName(event.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  required
                  disabled={savingPermissions}
                />
              </label>
              <strong>Uprawnienia do modułów</strong>
              <PermissionsSelector
                value={editingPermissions}
                onToggle={(moduleId, actionId) =>
                  updateModulePermission(
                    setEditingPermissions,
                    moduleId,
                    actionId
                  )
                }
                onToggleFull={(moduleId, checked) =>
                  updateFullModule(setEditingPermissions, moduleId, checked)
                }
                expandedModule={expandedModule}
                onExpand={setExpandedModule}
              />
              <div className="users-modal-actions">
                <button
                  type="button"
                  className="users-modal-cancel"
                  onClick={() => setEditingUser(null)}
                  disabled={savingPermissions}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="users-modal-submit"
                  disabled={savingPermissions}
                >
                  {savingPermissions
                    ? 'Zapisywanie...'
                    : editingUser.status === 'pending_approval'
                    ? 'Zatwierdź konto i zapisz uprawnienia'
                    : 'Zapisz zmiany'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
          >
            <div className="users-modal-header">
              <div>
                <span className="users-modal-eyebrow">NOWE ZAPROSZENIE</span>
                <h3 id="users-modal-title">Utwórz zaproszenie</h3>
                <p>Ustal liczbę wykorzystań i okres ważności linku.</p>
              </div>
              <button
                type="button"
                className="users-modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <form className="users-modal-form" onSubmit={handleAddUser}>
              <label>
                <span>Liczba wykorzystań</span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={invitationLimit}
                  onChange={(event) => setInvitationLimit(event.target.value)}
                  disabled={unlimitedInvitations}
                  required={!unlimitedInvitations}
                />
              </label>
              <label className="users-checkbox-label">
                <input
                  type="checkbox"
                  checked={unlimitedInvitations}
                  onChange={(event) =>
                    setUnlimitedInvitations(event.target.checked)
                  }
                />
                Bez limitu wykorzystań
              </label>
              <div className="users-invitation-datetime">
                <SharedDatePicker
                  label="Ważne od (opcjonalnie)"
                  name="invitationStartsAtDate"
                  value={getInvitationDatePart(invitationStartsAt)}
                  onChange={(date) =>
                    setInvitationStartsAt((previous) =>
                      setInvitationDatePart(previous, date)
                    )
                  }
                  disabled={submitting}
                />
                <InvitationTimePicker
                  label="Godzina rozpoczęcia"
                  value={getInvitationTimePart(invitationStartsAt)}
                  onChange={(time) =>
                    setInvitationStartsAt((previous) =>
                      setInvitationTimePart(previous, time)
                    )
                  }
                  disabled={
                    submitting || !getInvitationDatePart(invitationStartsAt)
                  }
                />
              </div>
              <div className="users-invitation-datetime">
                <SharedDatePicker
                  label="Ważne do (opcjonalnie)"
                  name="invitationEndsAtDate"
                  value={getInvitationDatePart(invitationEndsAt)}
                  onChange={(date) =>
                    setInvitationEndsAt((previous) =>
                      setInvitationDatePart(previous, date)
                    )
                  }
                  min={getInvitationDatePart(invitationStartsAt) || undefined}
                  disabled={submitting}
                />
                <InvitationTimePicker
                  label="Godzina zakończenia"
                  value={getInvitationTimePart(invitationEndsAt)}
                  onChange={(time) =>
                    setInvitationEndsAt((previous) =>
                      setInvitationTimePart(previous, time)
                    )
                  }
                  disabled={
                    submitting || !getInvitationDatePart(invitationEndsAt)
                  }
                />
              </div>
              <div className="users-modal-info">
                Nie musisz podawać imienia ani e-maila. Dane zostaną podane
                podczas rejestracji. Po potwierdzeniu adresu e-mail konto trafi
                do próśb o rejestrację. Nie otrzyma żadnych uprawnień, dopóki
                administrator go nie zatwierdzi i nie wybierze zakresu dostępu.
              </div>
              <div className="users-modal-actions">
                <button
                  type="button"
                  className="users-modal-cancel"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="users-modal-submit"
                  disabled={submitting}
                >
                  {submitting ? 'Zapisywanie...' : 'Utwórz zaproszenie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
