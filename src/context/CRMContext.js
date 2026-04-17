import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { createSeedSettings } from "data/veraluzSeed";
import { useAuth } from "context/AuthContext";
import { apiRequest } from "services/apiClient";
import { createRealtimeConnection } from "services/realtimeClient";
import { computeDashboardMetrics } from "utils/crm";
import { getInitials } from "utils/formatters";

const CRMContext = createContext();
const REMOVED_PIPELINE_STAGE_NAME = "Qualificado";
const REMOVED_ORIGIN_NAME = "Indicação";

function toId(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function mapNameList(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems;
  }

  return items
    .map((item) => (typeof item === "string" ? item : item?.name || ""))
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapNamedRecords(items, fallbackItems) {
  const sourceItems = Array.isArray(items) && items.length ? items : fallbackItems;

  return sourceItems
    .map((item) => {
      if (typeof item === "string") {
        return {
          id: "",
          name: item.trim(),
        };
      }

      return {
        id: toId(item?.id),
        name: String(item?.name || "").trim(),
      };
    })
    .filter((item) => item.name);
}

function normalizeDateTime(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string" && value.length === 16) {
    return `${value}:00`;
  }

  return value;
}

function normalizeComparableText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeContractType(value = "") {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const comparableValue = normalizeComparableText(normalizedValue);

  if (
    comparableValue === "renovacao" ||
    comparableValue.includes("trocar") ||
    comparableValue.includes("migr") ||
    comparableValue.includes("portabilidade")
  ) {
    return "Trocar de plano";
  }

  return normalizedValue;
}

function normalizeUser(user = {}) {
  const fullName = user.fullName || user.name || "";

  return {
    id: toId(user.id),
    name: fullName,
    email: user.email || "",
    phone: user.phone || "",
    city: user.city || "",
    state: user.state || "",
    role: user.role || "",
    active: user.active ?? true,
    onlyOwnLeads: Boolean(user.onlyOwnLeads),
    lastLogin: user.lastLoginAt || user.lastLogin || "",
    avatar: user.avatar || getInitials(fullName),
  };
}

function normalizeTask(task = {}) {
  return {
    id: toId(task.id),
    title: task.title || "",
    type: task.type || task.taskType || "",
    dueDate: task.dueDate || task.dueAt || "",
    notes: task.notes || "",
    completed: Boolean(task.completed),
    completedAt: task.completedAt || "",
    createdAt: task.createdAt || "",
    leadId: toId(task.leadId),
    leadName: task.leadName || "",
    leadPhone: task.leadPhone || "",
    ownerId: toId(task.ownerUserId || task.ownerId),
    ownerName: task.ownerName || "",
    stage: task.pipelineStage || task.stage || "",
  };
}

function normalizeLead(lead = {}) {
  return {
    id: toId(lead.id),
    fullName: lead.fullName || "",
    phone: lead.phone || "",
    email: lead.email || "",
    cpf: lead.cpf || "",
    city: lead.city || "",
    state: lead.state || "",
    neighborhood: lead.neighborhood || "",
    ageRange: lead.ageRange || "",
    beneficiaryAgeRanges: Array.isArray(lead.beneficiaryAgeRanges)
      ? lead.beneficiaryAgeRanges.filter(Boolean)
      : [],
    beneficiaries: Number(lead.beneficiaries || 0),
    planType: lead.planType || "",
    contractType: normalizeContractType(lead.contractType),
    companyName: lead.companyName || "",
    cnpj: lead.cnpj || "",
    entityName: lead.entityName || "",
    hasActiveCnpj: Boolean(lead.hasActiveCnpj),
    hasActiveMei: Boolean(lead.hasActiveMei),
    operatorInterest: lead.operatorInterest || "",
    budgetRange: lead.budgetRange || "",
    coparticipation: lead.coparticipation || "",
    coverage: lead.coverage || "",
    urgency: lead.urgency || "",
    stage: lead.pipelineStage || lead.stage || "Novo lead",
    status: lead.status || "Novo lead",
    temperature: lead.temperature || "Frio",
    tags: Array.isArray(lead.tags) ? lead.tags.filter(Boolean) : [],
    ownerId: toId(lead.ownerUserId || lead.ownerId),
    ownerName: lead.ownerName || "",
    origin: lead.origin || "Cadastro manual",
    sourceCampaign: lead.sourceCampaign || "",
    notes: lead.notes || "",
    initialNotes: lead.initialNotes || "",
    hasWhatsapp: lead.hasWhatsapp ?? true,
    hasCurrentPlan: Boolean(lead.hasCurrentPlan),
    currentPlan: lead.currentPlan || "",
    currentPlanExpiry: lead.currentPlanExpiry || "",
    nextContact: lead.nextContactAt || lead.nextContact || "",
    lossReason: lead.lossReason || "",
    closedAt: lead.closedAt || "",
    createdAt: lead.createdAt || "",
    updatedAt: lead.updatedAt || "",
    interactions: Array.isArray(lead.interactions)
      ? lead.interactions.map((interaction) => ({
          id: toId(interaction.id),
          channel: interaction.channel || "",
          subject: interaction.subject || "",
          summary: interaction.summary || "",
          date: interaction.date || "",
          createdBy: interaction.createdBy || "",
        }))
      : [],
    tasks: Array.isArray(lead.tasks) ? lead.tasks.map(normalizeTask) : [],
    documents: Array.isArray(lead.documents)
      ? lead.documents.map((document) => ({
          id: toId(document.id),
          label: document.label || "",
          fileName: document.fileName || "",
          filePath: document.filePath || "",
          mimeType: document.mimeType || "",
          uploadedAt: document.uploadedAt || "",
        }))
      : [],
    timeline: Array.isArray(lead.timeline)
      ? lead.timeline.map((item) => ({
          id: toId(item.id),
          title: item.title || "",
          description: item.description || "",
          icon: item.icon || "info",
          color: item.color || "info",
          date: item.date || "",
        }))
      : [],
    assignments: Array.isArray(lead.assignments)
      ? lead.assignments.map((item) => ({
          id: toId(item.id),
          assignedAt: item.assignedAt || "",
          notes: item.notes || "",
          userName: item.userName || "",
          assignedBy: item.assignedBy || "",
        }))
      : [],
  };
}

function normalizeIntegration(integration = {}) {
  return {
    id: toId(integration.id),
    channel: integration.channel || "",
    name: integration.name || "",
    status: integration.status || "",
    lastSync: integration.lastSyncAt || integration.lastSync || "",
    originMapping: integration.originMapping || "",
    rule: integration.ruleDescription || integration.rule || "",
    webhookUrl: integration.webhookUrl || "",
    settings: integration.settings || {},
  };
}

function normalizeFormSubmission(submission = {}) {
  return {
    id: toId(submission.id),
    fullName: submission.fullName || "",
    phone: submission.phone || "",
    email: submission.email || "",
    city: submission.city || "",
    state: submission.state || "",
    planType: submission.planType || "",
    beneficiaries: Number(submission.beneficiaries || 0),
    origin: submission.origin || "",
    campaign: submission.campaign || "",
    rawPayload: submission.rawPayload || submission.rawPayloadJson || {},
    receivedAt: submission.receivedAt || "",
    imported: Boolean(submission.imported),
    importedLeadId: toId(submission.importedLeadId),
    status: submission.status || "",
  };
}

function normalizeConversation(conversation = {}) {
  return {
    id: toId(conversation.id),
    externalId: conversation.externalId || "",
    source: conversation.source || "",
    channel: conversation.channel || "",
    channelKey: conversation.channelKey || "",
    departmentId: conversation.departmentId || "",
    departmentName: conversation.departmentName || "",
    leadId: toId(conversation.leadId),
    leadName: conversation.leadName || "",
    leadPhone: conversation.leadPhone || "",
    ownerUserId: toId(conversation.ownerUserId),
    ownerName: conversation.ownerName || "",
    chatId: conversation.chatId || "",
    contactName: conversation.contactName || "",
    contactPhone: conversation.contactPhone || "",
    contactEmail: conversation.contactEmail || "",
    contactAvatarUrl: conversation.contactAvatarUrl || "",
    protocol: conversation.protocol || "",
    status: conversation.status || "open",
    unreadCount: Number(conversation.unreadCount || 0),
    lastMessagePreview: conversation.lastMessagePreview || "",
    lastMessageAt: conversation.lastMessageAt || "",
    updatedAt: conversation.updatedAt || "",
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map((message) => ({
          id: toId(message.id),
          externalMessageId: message.externalMessageId || "",
          direction: message.direction || "inbound",
          channel: message.channel || "",
          channelKey: message.channelKey || "",
          messageType: message.messageType || "text",
          body: message.body || "",
          mediaUrl: message.mediaUrl || "",
          mimeType: message.mimeType || "",
          fileName: message.fileName || "",
          status: message.status || "",
          senderName: message.senderName || "",
          senderPhone: message.senderPhone || "",
          createdBy: message.createdBy || "",
          sentAt: message.sentAt || "",
          deliveredAt: message.deliveredAt || "",
          readAt: message.readAt || "",
          failedAt: message.failedAt || "",
          createdAt: message.createdAt || "",
        }))
      : [],
  };
}

function normalizeSettings(settings = {}) {
  const seedSettings = createSeedSettings();
  const pipelineStageRecords = mapNamedRecords(
    settings.stages || settings.pipelineStageRecords || settings.pipelineStages,
    seedSettings.pipelineStages
  ).filter((item) => item.name !== REMOVED_PIPELINE_STAGE_NAME);

  return {
    pipelineStageRecords,
    pipelineStages: pipelineStageRecords.map((item) => item.name),
    planTypes: mapNameList(settings.planTypes, seedSettings.planTypes),
    operatorInterests: mapNameList(settings.operatorInterests, seedSettings.operatorInterests),
    tags: mapNameList(settings.tags, seedSettings.tags),
    lossReasons: mapNameList(settings.lossReasons, seedSettings.lossReasons),
    origins: mapNameList(settings.origins, seedSettings.origins).filter(
      (item) => item !== REMOVED_ORIGIN_NAME
    ),
    brokerage: {
      ...seedSettings.brokerage,
      ...(settings.brokerage || {}),
    },
    notifications: {
      ...seedSettings.notifications,
      ...(settings.notifications || {}),
    },
  };
}

function buildLeadPayload(values) {
  return {
    fullName: values.fullName?.trim() || "",
    phone: values.phone?.trim() || "",
    email: values.email?.trim() || "",
    cpf: values.cpf?.trim() || "",
    city: values.city?.trim() || "",
    state: values.state?.trim() || "",
    neighborhood: values.neighborhood?.trim() || "",
    ageRange: values.ageRange || "",
    ...(Array.isArray(values.beneficiaryAgeRanges)
      ? { beneficiaryAgeRanges: values.beneficiaryAgeRanges.filter(Boolean) }
      : {}),
    beneficiaries: Number(values.beneficiaries || 1),
    planType: values.planType || "",
    contractType: normalizeContractType(values.contractType),
    companyName: values.companyName?.trim() || "",
    cnpj: values.cnpj?.trim() || "",
    entityName: values.entityName?.trim() || "",
    hasActiveCnpj: Boolean(values.hasActiveCnpj),
    hasActiveMei: Boolean(values.hasActiveMei),
    operatorInterest: values.operatorInterest?.trim() || "",
    budgetRange: values.budgetRange?.trim() || "",
    coparticipation: values.coparticipation || "",
    coverage: values.coverage || "",
    urgency: values.urgency || "",
    pipelineStage: values.stage || values.pipelineStage || "Novo lead",
    status: values.status || "",
    temperature: values.temperature || "Frio",
    tags: Array.isArray(values.tags) ? values.tags : [],
    ownerUserId: values.ownerId || values.ownerUserId || null,
    origin: values.origin || "Cadastro manual",
    sourceCampaign: values.sourceCampaign?.trim() || "",
    notes: values.notes || "",
    initialNotes: values.initialNotes || "",
    hasWhatsapp: values.hasWhatsapp ?? true,
    hasCurrentPlan: Boolean(values.hasCurrentPlan),
    currentPlan: values.currentPlan?.trim() || "",
    currentPlanExpiry: values.currentPlanExpiry || null,
    nextContactAt: normalizeDateTime(values.nextContact || values.nextContactAt),
    lossReason: values.lossReason || "",
    closedAt: values.closedAt || null,
  };
}

function buildSettingsPayload(settings) {
  return {
    planTypes: settings.planTypes,
    operatorInterests: settings.operatorInterests,
    tags: settings.tags,
    brokerage: settings.brokerage,
    notifications: settings.notifications,
  };
}

function sortLeads(leads) {
  return [...leads].sort(
    (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
  );
}

function sortTasks(tasks) {
  return [...tasks].sort(
    (left, right) => new Date(left.dueDate || 0) - new Date(right.dueDate || 0)
  );
}

function sortSubmissions(submissions) {
  return [...submissions].sort(
    (left, right) => new Date(right.receivedAt || 0) - new Date(left.receivedAt || 0)
  );
}

function sortConversations(conversations) {
  return [...conversations].sort(
    (left, right) =>
      new Date(right.lastMessageAt || right.updatedAt || 0) -
      new Date(left.lastMessageAt || left.updatedAt || 0)
  );
}

function buildDuplicateResult(message) {
  if (!message?.toLowerCase().includes("duplicado")) {
    return null;
  }

  const matchedName = message.match(/:\s(.+)\.$/);

  return matchedName?.[1]
    ? {
        fullName: matchedName[1],
      }
    : null;
}

function mergeCurrentUser(users, currentUser) {
  if (!currentUser?.id) {
    return users;
  }

  const normalizedCurrentUser = normalizeUser(currentUser);
  const nextUsers = [
    normalizedCurrentUser,
    ...users.filter((user) => user.id !== normalizedCurrentUser.id),
  ];

  return nextUsers.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function CRMProvider({ children }) {
  const { authReady, currentUser, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [leadDetailsById, setLeadDetailsById] = useState({});
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [formSubmissions, setFormSubmissions] = useState([]);
  const [inboxConversations, setInboxConversations] = useState([]);
  const [conversationDetailsById, setConversationDetailsById] = useState({});
  const [settings, setSettings] = useState(createSeedSettings());
  const refreshDataRef = useRef(async () => {});
  const refreshInFlightRef = useRef(null);
  const pendingRefreshRef = useRef(false);

  const getOwnerName = (ownerId, fallbackOwnerName = "") =>
    users.find((user) => user.id === toId(ownerId))?.name || fallbackOwnerName || "Sem corretor";

  const replaceTasksForLead = (lead) => {
    const normalizedLead = normalizeLead(lead);
    const nextTasks = normalizedLead.tasks.map((task) =>
      normalizeTask({
        ...task,
        leadId: normalizedLead.id,
        leadName: normalizedLead.fullName,
        leadPhone: normalizedLead.phone,
        ownerId: normalizedLead.ownerId,
        ownerName: getOwnerName(normalizedLead.ownerId, normalizedLead.ownerName),
        stage: normalizedLead.stage,
      })
    );

    setTasks((previousTasks) =>
      sortTasks([
        ...previousTasks.filter((task) => task.leadId !== normalizedLead.id),
        ...nextTasks,
      ])
    );
  };

  const syncLeadState = (apiLead) => {
    const normalizedLead = normalizeLead(apiLead);
    const hydratedLead = {
      ...normalizedLead,
      ownerName: getOwnerName(normalizedLead.ownerId, normalizedLead.ownerName),
    };

    setLeads((previousLeads) =>
      sortLeads([...previousLeads.filter((lead) => lead.id !== hydratedLead.id), hydratedLead])
    );
    setLeadDetailsById((previousDetails) => ({
      ...previousDetails,
      [hydratedLead.id]: hydratedLead,
    }));
    replaceTasksForLead(hydratedLead);

    return hydratedLead;
  };

  const syncConversationState = (apiConversation) => {
    const normalizedConversation = normalizeConversation(apiConversation);

    setInboxConversations((previousConversations) =>
      sortConversations([
        ...previousConversations.filter(
          (conversation) => conversation.id !== normalizedConversation.id
        ),
        normalizedConversation,
      ])
    );
    setConversationDetailsById((previousDetails) => ({
      ...previousDetails,
      [normalizedConversation.id]: normalizedConversation,
    }));

    return normalizedConversation;
  };

  const removeLeadState = (leadId) => {
    const normalizedLeadId = toId(leadId);

    if (!normalizedLeadId) {
      return;
    }

    setLeads((previousLeads) => previousLeads.filter((lead) => lead.id !== normalizedLeadId));
    setLeadDetailsById((previousDetails) => {
      const nextDetails = { ...previousDetails };
      delete nextDetails[normalizedLeadId];
      return nextDetails;
    });
    setTasks((previousTasks) => previousTasks.filter((task) => task.leadId !== normalizedLeadId));
    setFormSubmissions((previousSubmissions) =>
      sortSubmissions(
        previousSubmissions.map((submission) =>
          submission.importedLeadId === normalizedLeadId
            ? {
                ...submission,
                imported: false,
                importedLeadId: "",
                status: "Novo",
              }
            : submission
        )
      )
    );
    setInboxConversations((previousConversations) =>
      sortConversations(
        previousConversations.filter((conversation) => conversation.leadId !== normalizedLeadId)
      )
    );
    setConversationDetailsById((previousDetails) =>
      Object.fromEntries(
        Object.entries(previousDetails).filter(
          ([, conversation]) => conversation.leadId !== normalizedLeadId
        )
      )
    );
  };

  refreshDataRef.current = async ({ showLoading = false, resetOnError = false } = {}) => {
    if (!authReady) {
      return;
    }

    if (!isAuthenticated) {
      setLeads([]);
      setLeadDetailsById({});
      setUsers([]);
      setTasks([]);
      setIntegrations([]);
      setFormSubmissions([]);
      setInboxConversations([]);
      setConversationDetailsById({});
      setSettings(createSeedSettings());
      setLoading(false);
      return;
    }

    if (refreshInFlightRef.current) {
      pendingRefreshRef.current = true;
      return refreshInFlightRef.current;
    }

    if (showLoading) {
      setLoading(true);
    }

    const request = (async () => {
      try {
        const detailIds = Object.keys(leadDetailsById);
        const canManageIntegrations = ["admin", "manager"].includes(currentUser?.role || "");
        const usersRequest =
          currentUser?.role === "broker"
            ? Promise.resolve({ users: currentUser ? [currentUser] : [] })
            : apiRequest("/api/users").catch((error) => {
                if (error.status === 403) {
                  return { users: currentUser ? [currentUser] : [] };
                }

                throw error;
              });
        const integrationsRequest = canManageIntegrations
          ? apiRequest("/api/integrations").catch((error) => {
              if (error.status === 403) {
                return { integrations: [] };
              }

              throw error;
            })
          : Promise.resolve({ integrations: [] });
        const submissionsRequest = canManageIntegrations
          ? apiRequest("/api/integrations/form-submissions").catch((error) => {
              if (error.status === 403) {
                return { submissions: [] };
              }

              throw error;
            })
          : Promise.resolve({ submissions: [] });

        const [
          leadsResponse,
          tasksResponse,
          usersResponse,
          integrationsResponse,
          submissionsResponse,
          inboxResponse,
          settingsResponse,
          detailResponses,
        ] = await Promise.all([
          apiRequest("/api/leads"),
          apiRequest("/api/tasks"),
          usersRequest,
          integrationsRequest,
          submissionsRequest,
          apiRequest("/api/inbox/conversations"),
          apiRequest("/api/settings"),
          detailIds.length
            ? Promise.all(
                detailIds.map((leadId) => apiRequest(`/api/leads/${leadId}`).catch(() => null))
              )
            : Promise.resolve([]),
        ]);

        const normalizedLeads = sortLeads((leadsResponse.leads || []).map(normalizeLead));
        const normalizedUsers = mergeCurrentUser(
          (usersResponse.users || []).map(normalizeUser),
          currentUser
        );

        setLeads(normalizedLeads);
        setTasks(sortTasks((tasksResponse.tasks || []).map(normalizeTask)));
        setUsers(normalizedUsers);
        setIntegrations((integrationsResponse.integrations || []).map(normalizeIntegration));
        setFormSubmissions(
          sortSubmissions((submissionsResponse.submissions || []).map(normalizeFormSubmission))
        );
        setInboxConversations(
          sortConversations((inboxResponse.conversations || []).map(normalizeConversation))
        );
        setSettings(normalizeSettings(settingsResponse.settings));
        setLeadDetailsById((previousDetails) => {
          if (!detailResponses.length) {
            return previousDetails;
          }

          const nextDetails = { ...previousDetails };

          detailResponses.forEach((response) => {
            if (!response?.lead) {
              return;
            }

            const normalizedDetail = normalizeLead(response.lead);
            nextDetails[normalizedDetail.id] = {
              ...normalizedDetail,
              ownerName:
                normalizedUsers.find((user) => user.id === normalizedDetail.ownerId)?.name ||
                normalizedDetail.ownerName ||
                "Sem corretor",
            };
          });

          return nextDetails;
        });
      } catch (error) {
        if (resetOnError) {
          setLeads([]);
          setLeadDetailsById({});
          setUsers(currentUser ? [normalizeUser(currentUser)] : []);
          setTasks([]);
          setIntegrations([]);
          setFormSubmissions([]);
          setInboxConversations([]);
          setConversationDetailsById({});
          setSettings(createSeedSettings());
        }
      } finally {
        refreshInFlightRef.current = null;

        if (showLoading) {
          setLoading(false);
        }

        if (pendingRefreshRef.current) {
          pendingRefreshRef.current = false;
          refreshDataRef.current({ showLoading: false, resetOnError: false });
        }
      }
    })();

    refreshInFlightRef.current = request;
    return request;
  };

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!authReady) {
        return;
      }

      if (!isAuthenticated) {
        if (!isMounted) {
          return;
        }

        setLeads([]);
        setLeadDetailsById({});
        setUsers([]);
        setTasks([]);
        setIntegrations([]);
        setFormSubmissions([]);
        setInboxConversations([]);
        setConversationDetailsById({});
        setSettings(createSeedSettings());
        setLoading(false);
        return;
      }

      try {
        if (!isMounted) {
          return;
        }

        await refreshDataRef.current({ showLoading: true, resetOnError: true });
      } catch (error) {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [authReady, currentUser, isAuthenticated]);

  useEffect(() => {
    if (!authReady || !isAuthenticated || typeof window === "undefined") {
      return undefined;
    }

    let refreshTimeoutId = null;
    const connection = createRealtimeConnection({
      onUpdate: () => {
        if (refreshTimeoutId) {
          window.clearTimeout(refreshTimeoutId);
        }

        refreshTimeoutId = window.setTimeout(() => {
          refreshDataRef.current({ showLoading: false, resetOnError: false });
        }, 200);
      },
    });

    return () => {
      if (refreshTimeoutId) {
        window.clearTimeout(refreshTimeoutId);
      }

      connection?.close();
    };
  }, [authReady, currentUser?.id, isAuthenticated]);

  const leadsWithTasks = useMemo(() => {
    const taskMap = tasks.reduce((accumulator, task) => {
      if (!accumulator[task.leadId]) {
        accumulator[task.leadId] = [];
      }

      accumulator[task.leadId].push(task);
      return accumulator;
    }, {});

    const leadMap = new Map();

    leads.forEach((lead) => {
      leadMap.set(lead.id, lead);
    });

    Object.values(leadDetailsById).forEach((lead) => {
      leadMap.set(lead.id, {
        ...(leadMap.get(lead.id) || {}),
        ...lead,
      });
    });

    return sortLeads(
      Array.from(leadMap.values()).map((lead) => ({
        ...lead,
        ownerName: getOwnerName(lead.ownerId, lead.ownerName),
        tasks: taskMap[lead.id] || lead.tasks || [],
      }))
    );
  }, [leadDetailsById, leads, tasks, users]);

  const dashboard = useMemo(
    () => computeDashboardMetrics(leadsWithTasks, users),
    [leadsWithTasks, users]
  );

  function getLeadById(leadId) {
    return leadDetailsById[leadId] || leads.find((lead) => lead.id === toId(leadId)) || null;
  }

  async function fetchLeadById(leadId) {
    try {
      const response = await apiRequest(`/api/leads/${leadId}`);
      return syncLeadState(response.lead);
    } catch (error) {
      return null;
    }
  }

  function getConversationById(conversationId) {
    return (
      conversationDetailsById[conversationId] ||
      inboxConversations.find((conversation) => conversation.id === toId(conversationId)) ||
      null
    );
  }

  async function fetchConversationById(conversationId) {
    try {
      const response = await apiRequest(`/api/inbox/conversations/${conversationId}`);
      return syncConversationState(response.conversation);
    } catch (error) {
      return null;
    }
  }

  async function sendInboxMessage(conversationId, payload) {
    try {
      let requestBody;

      if (payload.file) {
        const formData = new FormData();
        formData.append("file", payload.file);
        if (payload.body) formData.append("body", payload.body);
        requestBody = formData;
      } else {
        requestBody = {
          body: payload.body || "",
          messageType: payload.messageType || "text",
        };
      }

      const response = await apiRequest(`/api/inbox/conversations/${conversationId}/messages`, {
        method: "POST",
        body: requestBody,
      });

      return {
        ok: true,
        conversation: syncConversationState(response.conversation),
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível enviar a mensagem.",
      };
    }
  }

  async function registerInboxWebhooks() {
    try {
      const response = await apiRequest("/api/inbox/webhooks/register", {
        method: "POST",
      });

      await refreshDataRef.current({ showLoading: false, resetOnError: false });

      return {
        ok: true,
        channels: Array.isArray(response.channels) ? response.channels : [],
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível registrar os webhooks da Zap Responder.",
      };
    }
  }

  async function createLead(values) {
    try {
      const response = await apiRequest("/api/leads", {
        method: "POST",
        body: buildLeadPayload(values),
      });

      return { ok: true, lead: syncLeadState(response.lead) };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível salvar o lead.",
        duplicateLead: buildDuplicateResult(error.message),
      };
    }
  }

  async function updateLead(leadId, values) {
    try {
      const response = await apiRequest(`/api/leads/${leadId}`, {
        method: "PUT",
        body: buildLeadPayload(values),
      });

      return { ok: true, lead: syncLeadState(response.lead) };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível atualizar o lead.",
        duplicateLead: buildDuplicateResult(error.message),
      };
    }
  }

  async function deleteLead(leadId) {
    try {
      const response = await apiRequest(`/api/leads/${leadId}`, {
        method: "DELETE",
      });
      const deletedLead = {
        id: toId(response.deletedLead?.id || leadId),
        fullName: response.deletedLead?.fullName || "",
      };

      removeLeadState(deletedLead.id);

      return { ok: true, deletedLead };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível excluir o lead.",
      };
    }
  }

  async function moveLeadStage(leadId, stage, options = {}) {
    try {
      const response = await apiRequest(`/api/leads/${leadId}/stage`, {
        method: "PATCH",
        body: {
          pipelineStage: stage,
          lossReason: options.lossReason || "",
        },
      });

      return { ok: true, lead: syncLeadState(response.lead) };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível mover o lead no funil.",
      };
    }
  }

  async function addInteraction(leadId, interaction) {
    try {
      const response = await apiRequest(`/api/leads/${leadId}/interactions`, {
        method: "POST",
        body: {
          channel: interaction.channel,
          subject: interaction.subject,
          summary: interaction.summary || "",
          nextContactAt: normalizeDateTime(interaction.nextContact || interaction.nextContactAt),
        },
      });

      return { ok: true, lead: syncLeadState(response.lead) };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível registrar a interação.",
      };
    }
  }

  async function addTask(leadId, task) {
    try {
      const response = await apiRequest(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        body: {
          title: task.title,
          taskType: task.type || task.taskType,
          dueAt: normalizeDateTime(task.dueDate || task.dueAt),
          notes: task.notes || "",
        },
      });

      return { ok: true, lead: syncLeadState(response.lead) };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível criar a tarefa.",
      };
    }
  }

  async function completeTask(leadId, taskId) {
    try {
      const response = await apiRequest(`/api/leads/${leadId}/tasks/${taskId}/complete`, {
        method: "PATCH",
      });

      return { ok: true, lead: syncLeadState(response.lead) };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível concluir a tarefa.",
      };
    }
  }

  async function addDocument(leadId, document) {
    const file = document?.file || document;

    if (!file) {
      return {
        ok: false,
        message: "Selecione um arquivo válido para anexar.",
      };
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiRequest(`/api/leads/${leadId}/documents`, {
        method: "POST",
        body: formData,
      });

      return { ok: true, lead: syncLeadState(response.lead) };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível anexar o documento.",
      };
    }
  }

  async function importSubmission(submissionId) {
    try {
      const response = await apiRequest(
        `/api/integrations/form-submissions/${submissionId}/import`,
        {
          method: "POST",
        }
      );

      const lead = syncLeadState(response.lead);

      setFormSubmissions((previousSubmissions) =>
        sortSubmissions(
          previousSubmissions.map((submission) =>
            submission.id === toId(submissionId)
              ? {
                  ...submission,
                  imported: true,
                  importedLeadId: lead.id,
                  status: "Importado",
                }
              : submission
          )
        )
      );

      return { ok: true, lead };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível importar o formulário.",
        duplicateLead: buildDuplicateResult(error.message),
      };
    }
  }

  async function createUser(values) {
    try {
      const response = await apiRequest("/api/users", {
        method: "POST",
        body: {
          fullName: values.name,
          email: values.email,
          phone: values.phone,
          city: values.city,
          state: values.state,
          password: values.password,
          role: values.role,
          onlyOwnLeads: values.onlyOwnLeads,
        },
      });

      const user = normalizeUser(response.user);
      setUsers((previousUsers) =>
        [...previousUsers.filter((item) => item.id !== user.id), user].sort((left, right) =>
          left.name.localeCompare(right.name, "pt-BR")
        )
      );

      return { ok: true, user };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível criar o usuário.",
      };
    }
  }

  async function toggleUserStatus(userId) {
    try {
      const response = await apiRequest(`/api/users/${userId}/toggle-status`, {
        method: "PATCH",
      });

      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user.id === toId(userId)
            ? {
                ...user,
                active: Boolean(response.user?.active),
              }
            : user
        )
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível atualizar o usuário.",
      };
    }
  }

  async function updateUser(userId, values) {
    try {
      const response = await apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        body: {
          fullName: values.name,
          email: values.email,
          phone: values.phone,
          city: values.city,
          state: values.state,
          role: values.role,
          onlyOwnLeads: values.onlyOwnLeads,
          password: values.password || undefined,
        },
      });

      const user = normalizeUser(response.user);
      setUsers((previousUsers) =>
        previousUsers
          .map((item) => (item.id === user.id ? user : item))
          .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
      );

      return { ok: true, user };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível atualizar o usuário.",
      };
    }
  }

  async function updateSettings(nextSettings) {
    const mergedSettings = normalizeSettings({
      ...settings,
      ...nextSettings,
      brokerage: {
        ...settings.brokerage,
        ...(nextSettings.brokerage || {}),
      },
      notifications: {
        ...settings.notifications,
        ...(nextSettings.notifications || {}),
      },
    });

    try {
      const response = await apiRequest("/api/settings", {
        method: "PUT",
        body: buildSettingsPayload(mergedSettings),
      });

      const normalizedSettings = normalizeSettings(response.settings);
      setSettings(normalizedSettings);
      await refreshDataRef.current({ showLoading: false, resetOnError: false });

      return { ok: true, settings: normalizedSettings };
    } catch (error) {
      setSettings(mergedSettings);

      return {
        ok: false,
        message: error.message || "Não foi possível salvar as configurações no servidor.",
      };
    }
  }

  async function resetSettings() {
    return updateSettings(createSeedSettings());
  }

  const value = useMemo(
    () => ({
      loading,
      leads: leadsWithTasks,
      users,
      tasks,
      integrations,
      formSubmissions,
      inboxConversations,
      settings,
      dashboard,
      getLeadById,
      fetchLeadById,
      getConversationById,
      fetchConversationById,
      sendInboxMessage,
      registerInboxWebhooks,
      createLead,
      updateLead,
      deleteLead,
      moveLeadStage,
      addInteraction,
      addTask,
      completeTask,
      addDocument,
      importSubmission,
      createUser,
      updateUser,
      toggleUserStatus,
      updateSettings,
      resetSettings,
    }),
    [
      dashboard,
      formSubmissions,
      inboxConversations,
      integrations,
      leadsWithTasks,
      loading,
      settings,
      tasks,
      users,
    ]
  );

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
}

CRMProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useCRM() {
  const context = useContext(CRMContext);

  if (!context) {
    throw new Error("useCRM must be used within CRMProvider");
  }

  return context;
}
