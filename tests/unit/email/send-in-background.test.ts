import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
let outsideRequest = false;
vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    if (outsideRequest) throw new Error("after() was called outside a request scope");
    afterMock(task);
  },
}));

const { sendInBackground } = await import("@/features/email/services/send-in-background");

describe("sendInBackground", () => {
  beforeEach(() => {
    afterMock.mockReset();
    outsideRequest = false;
  });

  it("hands the send to after(), so the platform keeps the function alive", async () => {
    const send = vi.fn().mockResolvedValue({ success: true });
    sendInBackground("verification", send);

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    await afterMock.mock.calls[0]![0]();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends in place when there is no request scope", async () => {
    outsideRequest = true;
    const send = vi.fn().mockResolvedValue({ success: true });
    sendInBackground("script", send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  it("never throws when the mail server fails", async () => {
    const send = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));
    sendInBackground("verification", send);
    await expect(afterMock.mock.calls[0]![0]()).resolves.toBeUndefined();
  });
});
