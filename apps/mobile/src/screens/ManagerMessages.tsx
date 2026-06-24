import {
  createManagerAnnouncement,
  createManagerConversation,
  fetchManagerAnnouncements,
  fetchManagerConversations,
  fetchManagerMessages,
  fetchManagerStaff,
  sendManagerMessage,
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
import { registerManagerPushToken } from '@/notifications/pushNotifications';
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

type MessageTab = 'messages' | 'announcements';

export default function ManagerMessages() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [tab, setTab] = useState<MessageTab>('messages');
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');

  const restaurantId = restaurant?.id;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getOwnerRestaurant()
      .then((ownerRestaurant) => {
        if (cancelled) return;
        setRestaurant(ownerRestaurant);
        if (ownerRestaurant?.id) {
          registerManagerPushToken(ownerRestaurant.id).catch(() => undefined);
        }
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Could not load restaurant.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetchManagerStaff(restaurantId),
      fetchManagerConversations(restaurantId),
      fetchManagerAnnouncements(restaurantId),
    ])
      .then(([staffRows, conversationRows, announcementRows]) => {
        if (cancelled) return;
        setContacts(staffRows);
        setConversations(conversationRows);
        setAnnouncements(announcementRows);
        if (conversationRows[0]?.id) {
          setSelectedId((current) => current || String(conversationRows[0].id));
        }
        setStatus('');
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Could not load messaging.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    fetchManagerMessages(restaurantId, selectedId)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Could not load messages.');
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, selectedId]);

  useEffect(() => {
    if (!restaurantId || !selectedId) return undefined;
    const intervalId = setInterval(() => {
      fetchManagerMessages(restaurantId, selectedId)
        .then(setMessages)
        .catch(() => undefined);
      fetchManagerConversations(restaurantId)
        .then(setConversations)
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [restaurantId, selectedId]);

  const selectedConversation = conversations.find((conversation) => String(conversation.id) === String(selectedId));

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
    if (!restaurantId || selectedMemberIds.length === 0) {
      setStatus('Choose at least one employee for the chat.');
      return;
    }
    const selectedContacts = contacts.filter((contact) => selectedMemberIds.includes(String(contact.id)));
    const groupTitle = selectedMemberIds.length > 1
      ? newChatTitle.trim() || selectedContacts.map((contact) => contact.name).filter(Boolean).join(', ')
      : null;
    setIsSaving(true);
    try {
      const conversation = await createManagerConversation(restaurantId, selectedMemberIds, groupTitle);
      const next = await fetchManagerConversations(restaurantId);
      setConversations(next);
      setSelectedId(String(conversation.id));
      setTab('messages');
      resetNewChat();
      setStatus(selectedMemberIds.length > 1 ? 'Group chat opened.' : 'DM opened.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not start chat.');
    } finally {
      setIsSaving(false);
    }
  };

  const send = async () => {
    if (!restaurantId || !selectedId || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    try {
      const sent = await sendManagerMessage(restaurantId, selectedId, body);
      setMessages((current) => [...current, sent]);
      const next = await fetchManagerConversations(restaurantId);
      setConversations(next);
      setStatus('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not send message.');
    }
  };

  const postAnnouncement = async () => {
    if (!restaurantId || !announcementTitle.trim() || !announcementBody.trim()) {
      setStatus('Announcement needs a title and message.');
      return;
    }
    setIsSaving(true);
    try {
      await createManagerAnnouncement(restaurantId, announcementTitle.trim(), announcementBody.trim());
      const next = await fetchManagerAnnouncements(restaurantId);
      setAnnouncements(next);
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setStatus('Announcement posted.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not post announcement.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenShell>
      <PageHeader
        eyebrow="Staff Ops"
        title="Messages"
        subtitle="Start DMs, group chats, and announcements from admin."
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

      {status ? (
        <View style={styles.stateCard}>
          <UiText variant="bodySmall" tone="muted">{status}</UiText>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.stateCard}>
          <UiText variant="bodySmall" tone="muted">Loading staff messaging...</UiText>
        </View>
      ) : null}

      {!isLoading && tab === 'messages' && (
        <View style={styles.messagesLayout}>
          <View style={styles.newChatRow}>
            <UiButton label="Start chat" size="small" onPress={() => setIsNewChatOpen(true)} style={styles.newChatButton} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threadStrip}>
            {conversations.length === 0 ? (
              <UiText variant="bodySmall" tone="muted">No staff chats yet.</UiText>
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
                    {conversationDisplayName(conversation)}
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
                {conversationDisplayName(selectedConversation)}
              </UiText>
              <ScrollView contentContainerStyle={styles.messageList}>
                {messages.length === 0 ? (
                  <UiText variant="bodySmall" tone="muted">No messages here yet.</UiText>
                ) : (
                  messages.map((message) => (
                    <View key={message.id} style={[styles.messageBubble, message.sender_user_id && styles.messageBubbleMine]}>
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

      {!isLoading && tab === 'announcements' && (
        <ScrollView contentContainerStyle={styles.announcementList} showsVerticalScrollIndicator={false}>
          <View style={styles.announcementComposer}>
            <TextField value={announcementTitle} onChangeText={setAnnouncementTitle} placeholder="Announcement title" />
            <TextField value={announcementBody} onChangeText={setAnnouncementBody} placeholder="Message to staff" multiline />
            <UiButton
              label={isSaving ? 'Posting...' : 'Post announcement'}
              disabled={isSaving || !announcementTitle.trim() || !announcementBody.trim()}
              onPress={postAnnouncement}
            />
          </View>
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

      <Modal animationType="slide" transparent visible={isNewChatOpen} onRequestClose={resetNewChat}>
        <View style={styles.modalOverlay}>
          <View style={styles.glassModal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <UiText variant="eyebrow" tone="muted">New Chat</UiText>
                <UiText variant="h3" style={styles.modalTitle}>Choose employees</UiText>
              </View>
              <Pressable onPress={resetNewChat} style={styles.closeButton}>
                <Feather name="x" size={18} color={palette.ink[600]} />
              </Pressable>
            </View>
            {selectedMemberIds.length > 1 ? (
              <TextField value={newChatTitle} onChangeText={setNewChatTitle} placeholder="Group name optional" />
            ) : null}
            <ScrollView contentContainerStyle={styles.contactList}>
              {contacts.length === 0 ? (
                <UiText variant="bodySmall" tone="muted">No employees found.</UiText>
              ) : contacts.map((contact) => {
                const active = selectedMemberIds.includes(String(contact.id));
                return (
                  <Pressable
                    key={contact.id}
                    onPress={() => toggleMember(String(contact.id))}
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

function conversationDisplayName(conversation: Conversation) {
  if (conversation.title) return conversation.title;
  const names = conversation.members?.map((member) => member.name).filter(Boolean) || [];
  return names.length > 0 ? names.join(', ') : 'Staff chat';
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
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
    margin: spacing[4],
    padding: spacing[4],
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
  announcementComposer: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: opsAccent,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  modalOverlay: {
    backgroundColor: 'rgba(12, 10, 8, 0.36)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  glassModal: {
    backgroundColor: semanticColors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '86%',
    padding: spacing[5],
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  modalTitle: {
    color: palette.ink[900],
    marginTop: spacing[1],
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  contactList: {
    gap: spacing[2],
    paddingVertical: spacing[3],
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
    backgroundColor: '#ffe4da',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  contactAvatarText: {
    color: opsAccent,
    fontFamily: 'Inter_700Bold',
  },
  contactName: {
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingTop: spacing[3],
  },
  modalActionButton: {
    flex: 1,
  },
});
