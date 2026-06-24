import {
  createEmployeeConversation,
  fetchEmployeeAnnouncements,
  fetchEmployeeContacts,
  fetchEmployeeConversations,
  fetchEmployeeMessages,
  sendEmployeeMessage,
  type Announcement,
  type Conversation,
  type ConversationMessage,
  type StaffContact,
} from '@/api/employeeOps';
import {
  AnnouncementCard,
  ConversationRow,
  PageHeader,
  ScreenShell,
  SegmentedControl,
  TextField,
  opsAccent,
} from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

type MessageTab = 'messages' | 'announcements';

export default function EmployeeMessages() {
  const [tab, setTab] = useState<MessageTab>('messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([fetchEmployeeConversations(), fetchEmployeeAnnouncements(), fetchEmployeeContacts()])
      .then(([conversationData, announcementData, contactData]) => {
        if (cancelled) return;
        setConversations(conversationData);
        setAnnouncements(announcementData);
        setContacts(contactData);
        if (!selectedId && conversationData[0]?.id) setSelectedId(String(conversationData[0].id));
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load messages.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    fetchEmployeeMessages(selectedId)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const intervalId = setInterval(() => {
      fetchEmployeeMessages(selectedId)
        .then(setMessages)
        .catch(() => undefined);
      fetchEmployeeConversations()
        .then(setConversations)
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [selectedId]);

  const send = async () => {
    if (!selectedId || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    try {
      const sent = await sendEmployeeMessage(selectedId, body);
      setMessages((current) => [...current, sent]);
      const next = await fetchEmployeeConversations();
      setConversations(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((current) => (
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    ));
  };

  const resetNewChat = () => {
    setIsNewChatOpen(false);
    setSelectedMemberIds([]);
    setNewChatTitle('');
  };

  const startConversation = async () => {
    if (selectedMemberIds.length === 0) {
      setError('Choose at least one staff member.');
      return;
    }
    setIsSaving(true);
    try {
      const conversation = await createEmployeeConversation(selectedMemberIds, newChatTitle);
      const next = await fetchEmployeeConversations();
      setConversations(next);
      setSelectedId(String(conversation.id));
      resetNewChat();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedConversation = conversations.find((conversation) => String(conversation.id) === String(selectedId));
  const chatContacts = contacts.filter((contact) => !contact.is_me);

  return (
    <ScreenShell>
      <PageHeader
        eyebrow="Staff Ops"
        title="Messaging"
        subtitle="Direct messages, group chats, and restaurant announcements."
        action={<IconChatButton onPress={() => setIsNewChatOpen(true)} />}
      />
      <SegmentedControl
        value={tab}
        options={[
          { id: 'messages', label: 'Messages' },
          { id: 'announcements', label: 'Announcements' },
        ]}
        onChange={setTab}
      />

      {isLoading && (
        <View style={styles.stateCard}>
          <UiText variant="bodySmall" tone="muted">Loading staff messages...</UiText>
        </View>
      )}
      {error && (
        <View style={styles.stateCard}>
          <UiText variant="title">Messaging unavailable</UiText>
          <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{error}</UiText>
        </View>
      )}

      {!isLoading && !error && tab === 'messages' && (
        <View style={styles.messagesLayout}>
          <View style={styles.newChatRow}>
            <UiButton label="New chat" size="small" onPress={() => setIsNewChatOpen(true)} style={styles.newChatButton} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threadStrip}>
            {conversations.length === 0 ? (
              <UiText variant="bodySmall" tone="muted">No active chats yet.</UiText>
            ) : (
              conversations.map((conversation) => (
                <Pressable
                  key={conversation.id}
                  onPress={() => setSelectedId(String(conversation.id))}
                  style={[styles.threadPill, String(conversation.id) === String(selectedId) && styles.threadPillActive]}
                >
                  <UiText
                    variant="caption"
                    style={String(conversation.id) === String(selectedId) ? styles.threadTextActive : styles.threadText}
                    numberOfLines={1}
                  >
                    {conversation.title || conversation.members?.map((member) => member.name).join(', ') || 'Chat'}
                  </UiText>
                </Pressable>
              ))
            )}
          </ScrollView>

          {!selectedConversation ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {conversations.map((conversation) => (
                <Pressable key={conversation.id} onPress={() => setSelectedId(String(conversation.id))}>
                  <ConversationRow conversation={conversation} />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.chatPanel}>
              <UiText variant="title" style={styles.chatTitle}>
                {selectedConversation.title || 'Staff chat'}
              </UiText>
              <ScrollView contentContainerStyle={styles.messageList}>
                {messages.length === 0 ? (
                  <UiText variant="bodySmall" tone="muted">No messages here yet.</UiText>
                ) : (
                  messages.map((message) => (
                    <View key={message.id} style={[styles.messageBubble, message.sender_waiter_id && styles.messageBubbleMine]}>
                      <UiText variant="caption" tone="muted">{message.sender_name || 'Manager'}</UiText>
                      <UiText variant="bodySmall" style={styles.messageBody}>{message.body}</UiText>
                    </View>
                  ))
                )}
              </ScrollView>
              <View style={styles.composer}>
                <View style={{ flex: 1 }}>
                  <TextField value={draft} onChangeText={setDraft} placeholder="Message" />
                </View>
                <UiButton label="Send" size="small" disabled={!draft.trim()} onPress={send} />
              </View>
            </View>
          )}
        </View>
      )}

      {!isLoading && !error && tab === 'announcements' && (
        <ScrollView contentContainerStyle={styles.announcementList} showsVerticalScrollIndicator={false}>
          {announcements.length === 0 ? (
            <View style={styles.stateCard}>
              <UiText variant="bodySmall" tone="muted">No announcements yet.</UiText>
            </View>
          ) : (
            announcements.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} />
            ))
          )}
        </ScrollView>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={isNewChatOpen}
        onRequestClose={resetNewChat}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.glassModal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <UiText variant="eyebrow" tone="muted">New Chat</UiText>
                <UiText variant="h3" style={styles.modalTitle}>Choose staff</UiText>
              </View>
              <Pressable onPress={resetNewChat} style={styles.closeButton}>
                <Feather name="x" size={18} color={palette.ink[600]} />
              </Pressable>
            </View>
            {selectedMemberIds.length > 1 ? (
              <TextField value={newChatTitle} onChangeText={setNewChatTitle} placeholder="Group name optional" />
            ) : null}
            <ScrollView contentContainerStyle={styles.contactList}>
              {chatContacts.length === 0 ? (
                <UiText variant="bodySmall" tone="muted">No staff contacts returned yet.</UiText>
              ) : chatContacts.map((contact) => {
                const active = selectedMemberIds.includes(contact.id);
                return (
                  <Pressable
                    key={contact.id}
                    onPress={() => toggleMember(contact.id)}
                    style={[styles.contactChoice, active && styles.contactChoiceActive]}
                  >
                    <View style={styles.contactAvatar}>
                      <UiText variant="caption" style={styles.contactAvatarText}>
                        {(contact.name || contact.email || '?').slice(0, 1).toUpperCase()}
                      </UiText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <UiText variant="body" style={styles.contactName}>{contact.name || contact.email || 'Staff'}</UiText>
                      <UiText variant="caption" tone="muted">{contact.role || 'Staff'}</UiText>
                    </View>
                    <Feather name={active ? 'check-circle' : 'circle'} size={19} color={active ? opsAccent : palette.ink[300]} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <UiButton label="Cancel" variant="secondary" onPress={resetNewChat} style={styles.modalActionButton} />
              <UiButton
                label={isSaving ? 'Starting...' : selectedMemberIds.length > 1 ? 'Create group' : 'Start DM'}
                disabled={isSaving || selectedMemberIds.length === 0}
                onPress={startConversation}
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function IconChatButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Start new chat" onPress={onPress} style={styles.headerIconButton}>
      <Feather name="edit-3" size={19} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
    margin: spacing[4],
    padding: spacing[5],
  },
  messagesLayout: {
    flex: 1,
  },
  newChatRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  newChatButton: {
    minWidth: 112,
  },
  threadStrip: {
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  threadPill: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 170,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  threadPillActive: {
    backgroundColor: opsAccent,
    borderColor: opsAccent,
  },
  threadText: {
    color: palette.ink[600],
  },
  threadTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 120,
  },
  chatPanel: {
    flex: 1,
  },
  chatTitle: {
    paddingHorizontal: spacing[5],
  },
  messageList: {
    gap: spacing[3],
    padding: spacing[5],
    paddingBottom: spacing[6],
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: '86%',
    padding: spacing[3],
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff0ea',
    borderColor: '#ffd1c3',
  },
  messageBody: {
    marginTop: spacing[1],
  },
  composer: {
    alignItems: 'center',
    borderTopColor: semanticColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[4],
    paddingBottom: spacing[5],
  },
  announcementList: {
    gap: spacing[3],
    padding: spacing[5],
    paddingBottom: 120,
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: opsAccent,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  modalOverlay: {
    backgroundColor: 'rgba(21, 19, 19, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  glassModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[4],
    maxHeight: '82%',
    padding: spacing[5],
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalTitle: {
    marginTop: spacing[1],
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  contactList: {
    gap: spacing[2],
    paddingBottom: spacing[2],
  },
  contactChoice: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
  },
  contactChoiceActive: {
    backgroundColor: '#fff0ea',
    borderColor: '#ffd1c3',
  },
  contactAvatar: {
    alignItems: 'center',
    backgroundColor: palette.sky[50],
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  contactAvatarText: {
    color: palette.sky[700],
    fontFamily: 'Inter_700Bold',
  },
  contactName: {
    color: palette.ink[900],
    fontFamily: 'Inter_700Bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalActionButton: {
    flex: 1,
  },
});
