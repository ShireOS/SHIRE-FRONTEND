import {
  fetchEmployeeAnnouncements,
  fetchEmployeeConversations,
  fetchEmployeeMessages,
  sendEmployeeMessage,
  type Announcement,
  type Conversation,
  type ConversationMessage,
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
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

type MessageTab = 'messages' | 'announcements';

export default function EmployeeMessages() {
  const [tab, setTab] = useState<MessageTab>('messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([fetchEmployeeConversations(), fetchEmployeeAnnouncements()])
      .then(([conversationData, announcementData]) => {
        if (cancelled) return;
        setConversations(conversationData);
        setAnnouncements(announcementData);
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

  const selectedConversation = conversations.find((conversation) => String(conversation.id) === String(selectedId));

  return (
    <ScreenShell>
      <PageHeader
        eyebrow="Staff Ops"
        title="Messaging"
        subtitle="Direct messages, group chats, and restaurant announcements."
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
          <ActivityIndicator color={palette.sky[700]} />
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
    </ScreenShell>
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
});
