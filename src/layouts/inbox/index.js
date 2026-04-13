import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import InboxMessageBubble from "components/veraluz/InboxMessageBubble";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useAuth } from "context/AuthContext";
import { useCRM } from "context/CRMContext";
import { apiRequest } from "services/apiClient";
import { formatDateTime, formatPhone, getInitials } from "utils/formatters";

function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const {
    inboxConversations,
    getConversationById,
    fetchConversationById,
    sendInboxMessage,
    registerInboxWebhooks,
  } = useCRM();
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [feedback, setFeedback] = useState({ type: "info", message: "" });
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [channels, setChannels] = useState([]);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("lg"));
  const [mobileView, setMobileView] = useState("list");

  const canManageIntegrations = ["admin", "manager"].includes(currentUser?.role);
  const requestedConversationId = searchParams.get("conversation") || "";
  const requestedLeadId = searchParams.get("lead") || "";
  const selectedConversation = getConversationById(selectedConversationId);

  const preferredConversationId = useMemo(() => {
    if (requestedConversationId) {
      const requestedConversation = inboxConversations.find(
        (conversation) => conversation.id === requestedConversationId
      );

      if (requestedConversation) {
        return requestedConversation.id;
      }
    }

    if (requestedLeadId) {
      const leadConversation = inboxConversations.find(
        (conversation) => conversation.leadId === requestedLeadId
      );

      if (leadConversation) {
        return leadConversation.id;
      }
    }

    return "";
  }, [inboxConversations, requestedConversationId, requestedLeadId]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return inboxConversations;
    }

    return inboxConversations.filter((conversation) =>
      [
        conversation.contactName,
        conversation.contactPhone,
        conversation.chatId,
        conversation.leadName,
        conversation.channel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [inboxConversations, search]);

  useEffect(() => {
    let ignore = false;

    async function loadChannels() {
      try {
        const response = await apiRequest("/api/inbox/channels");

        if (!ignore) {
          setChannels(Array.isArray(response.channels) ? response.channels : []);
        }
      } catch (error) {
        if (!ignore) {
          setChannels([]);
        }
      }
    }

    loadChannels();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (
      selectedConversationId &&
      !inboxConversations.find((item) => item.id === selectedConversationId)
    ) {
      setSelectedConversationId("");
    }
  }, [inboxConversations, selectedConversationId]);

  useEffect(() => {
    if (preferredConversationId && preferredConversationId !== selectedConversationId) {
      setSelectedConversationId(preferredConversationId);
      return;
    }

    if (!selectedConversationId && filteredConversations.length) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, preferredConversationId, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    fetchConversationById(selectedConversationId);
  }, [fetchConversationById, selectedConversationId]);

  const handleSelectConversation = async (conversationId) => {
    setSelectedConversationId(conversationId);
    if (isMobile) setMobileView("chat");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("conversation", String(conversationId));

    const targetConversation = inboxConversations.find(
      (conversation) => conversation.id === conversationId
    );
    if (targetConversation?.leadId) {
      nextParams.set("lead", String(targetConversation.leadId));
    }

    setSearchParams(nextParams, { replace: true });
    await fetchConversationById(conversationId);
  };

  const handleSendMessage = async () => {
    if (!selectedConversationId || (!composer.trim() && !attachedFile)) {
      return;
    }

    setSending(true);
    const messagePayload = { body: composer };
    if (attachedFile) {
      messagePayload.file = attachedFile;
    }
    const result = await sendInboxMessage(selectedConversationId, messagePayload);
    setSending(false);

    if (!result.ok) {
      setFeedback({
        type: "warning",
        message: result.message || "Não foi possível enviar a mensagem.",
      });
      return;
    }

    setComposer("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFeedback({
      type: "success",
      message: "Mensagem enviada com sucesso.",
    });
  };

  const handleRegisterWebhooks = async () => {
    setConnecting(true);
    const result = await registerInboxWebhooks();
    setConnecting(false);

    if (!result.ok) {
      setFeedback({
        type: "warning",
        message: result.message || "Não foi possível conectar os canais.",
      });
      return;
    }

    const response = await apiRequest("/api/inbox/channels").catch(() => ({ channels: [] }));
    setChannels(Array.isArray(response.channels) ? response.channels : []);
    setFeedback({
      type: "success",
      message: "Webhooks registrados na Zap Responder.",
    });
  };

  return (
    <PageShell
      title="Atendimento"
      description="Inbox unificada para WhatsApp, Instagram e Facebook."
    >
      <Grid container spacing={3}>
        <Snackbar
          open={!!feedback.message}
          autoHideDuration={4000}
          onClose={() => setFeedback({ type: "info", message: "" })}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={feedback.type}
            onClose={() => setFeedback({ type: "info", message: "" })}
          >
            {feedback.message}
          </Alert>
        </Snackbar>

        <Grid item xs={12}>
          <SectionCard
            title="Canais conectados"
            description="Departamentos ativos da Zap Responder e status do webhook do CRM."
            action={
              canManageIntegrations ? (
                <MDButton
                  variant="gradient"
                  color="brand"
                  size="small"
                  onClick={handleRegisterWebhooks}
                  disabled={connecting}
                >
                  {connecting ? "Conectando..." : "Registrar webhooks"}
                </MDButton>
              ) : null
            }
          >
            {channels.length ? (
              <Grid container spacing={2}>
                {channels.map((channel) => (
                  <Grid item xs={12} md={4} key={channel.departmentId}>
                    <MDBox p={2.5} bgColor="light" borderRadius="xl" height="100%">
                      <MDBox display="flex" gap={1} flexWrap="wrap" mb={1.5}>
                        <StatusChip value={channel.channel} type="origin" />
                      </MDBox>
                      <MDTypography variant="h6">{channel.departmentName}</MDTypography>
                      <MDTypography variant="caption" color="text" display="block" mt={1}>
                        Status: {channel.status}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        Última sincronização: {formatDateTime(channel.lastSyncAt)}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <EmptyState
                icon="hub"
                title="Nenhum canal sincronizado"
                description="Registre os webhooks da Zap Responder para começar a receber o atendimento no CRM."
              />
            )}
          </SectionCard>
        </Grid>

        <Grid
          item
          xs={12}
          lg={4}
          sx={{ display: isMobile && mobileView !== "list" ? "none" : "block" }}
        >
          <SectionCard
            title="Conversas"
            description="Atendimentos recebidos pelos canais conectados."
          >
            <TextField
              fullWidth
              size="small"
              label="Buscar conversa"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ mb: 2 }}
            />

            {filteredConversations.length ? (
              <MDBox maxHeight={378} overflow="auto" pr={0.5}>
                <List sx={{ p: 0 }}>
                  {filteredConversations.map((conversation, index) => (
                    <MDBox key={conversation.id}>
                      <ListItemButton
                        selected={conversation.id === selectedConversationId}
                        onClick={() => handleSelectConversation(conversation.id)}
                        sx={{ px: 0, py: 1.5, alignItems: "flex-start", minHeight: 118 }}
                      >
                        <Stack direction="row" spacing={2} width="100%" alignItems="flex-start">
                          <Avatar src={conversation.contactAvatarUrl}>
                            {getInitials(
                              conversation.contactName || conversation.leadName || "Contato"
                            )}
                          </Avatar>
                          <MDBox flexGrow={1} minWidth={0}>
                            <MDBox display="flex" justifyContent="space-between" gap={2}>
                              <MDTypography
                                variant="button"
                                fontWeight="medium"
                                sx={{ pr: 1, minWidth: 0 }}
                              >
                                {conversation.contactName ||
                                  conversation.chatId ||
                                  "Contato sem nome"}
                              </MDTypography>
                              <MDTypography variant="caption" color="text">
                                {formatDateTime(conversation.lastMessageAt)}
                              </MDTypography>
                            </MDBox>
                            <MDBox mt={0.5} display="flex" gap={1} flexWrap="wrap">
                              <StatusChip value={conversation.channel} type="origin" />
                              {conversation.unreadCount ? (
                                <MDTypography variant="caption" color="warning">
                                  {conversation.unreadCount} nova(s)
                                </MDTypography>
                              ) : null}
                            </MDBox>
                            <MDTypography variant="caption" color="text" display="block" mt={1}>
                              {conversation.leadName || formatPhone(conversation.contactPhone)}
                            </MDTypography>
                            <MDTypography
                              variant="caption"
                              color="text"
                              display="block"
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {conversation.lastMessagePreview || "Sem mensagens ainda."}
                            </MDTypography>
                          </MDBox>
                        </Stack>
                      </ListItemButton>
                      {index < filteredConversations.length - 1 ? <Divider /> : null}
                    </MDBox>
                  ))}
                </List>
              </MDBox>
            ) : (
              <EmptyState
                icon="forum"
                title="Nenhuma conversa encontrada"
                description="As novas mensagens recebidas pela Zap Responder vão aparecer aqui."
              />
            )}
          </SectionCard>
        </Grid>

        <Grid
          item
          xs={12}
          lg={8}
          sx={{ display: isMobile && mobileView !== "chat" ? "none" : "block" }}
        >
          <SectionCard
            title={
              selectedConversation
                ? selectedConversation.contactName || "Atendimento"
                : "Atendimento"
            }
            description={
              selectedConversation
                ? `${selectedConversation.channel} · ${formatPhone(
                    selectedConversation.contactPhone || selectedConversation.chatId
                  )}`
                : "Selecione uma conversa para responder dentro do CRM."
            }
            action={
              <MDBox display="flex" gap={1}>
                {isMobile ? (
                  <IconButton size="small" onClick={() => setMobileView("list")}>
                    <span className="material-icons">arrow_back</span>
                  </IconButton>
                ) : null}
                {selectedConversation?.leadId ? (
                  <MDButton
                    component={Link}
                    to={`/leads/${selectedConversation.leadId}`}
                    variant="outlined"
                    color="dark"
                    size="small"
                  >
                    Abrir lead
                  </MDButton>
                ) : null}
              </MDBox>
            }
          >
            {selectedConversation ? (
              <>
                <MDBox
                  minHeight={420}
                  maxHeight={520}
                  overflow="auto"
                  display="flex"
                  flexDirection="column"
                  gap={1.5}
                  pr={0.5}
                >
                  {selectedConversation.messages?.length ? (
                    selectedConversation.messages.map((message) => (
                      <InboxMessageBubble key={message.id} message={message} />
                    ))
                  ) : (
                    <EmptyState
                      icon="chat"
                      title="Sem mensagens sincronizadas"
                      description="Assim que o webhook receber eventos da Zap Responder, o histórico aparecerá aqui."
                    />
                  )}
                </MDBox>

                <Divider sx={{ my: 2 }} />

                {attachedFile ? (
                  <MDBox mb={1.5}>
                    <Chip
                      label={attachedFile.name}
                      onDelete={() => {
                        setAttachedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      size="small"
                      icon={
                        <span className="material-icons" style={{ fontSize: 18 }}>
                          description
                        </span>
                      }
                    />
                  </MDBox>
                ) : null}

                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Responder pelo CRM"
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                  />
                  <Stack direction="column" spacing={1} sx={{ flexShrink: 0 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf,.xlsx,.docx"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) setAttachedFile(file);
                      }}
                    />
                    <MDButton
                      variant="outlined"
                      color="dark"
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="material-icons" style={{ fontSize: 18, marginRight: 4 }}>
                        attach_file
                      </span>
                      Anexar
                    </MDButton>
                    <MDButton
                      variant="gradient"
                      color="brand"
                      onClick={handleSendMessage}
                      disabled={sending || (!composer.trim() && !attachedFile)}
                    >
                      {sending ? "Enviando..." : "Enviar"}
                    </MDButton>
                  </Stack>
                </Stack>
              </>
            ) : (
              <EmptyState
                icon="forum"
                title="Nenhuma conversa selecionada"
                description="Escolha um atendimento na lista para visualizar o histórico e responder."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Inbox;
