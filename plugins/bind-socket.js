/** Tiny helper — keeps global sock for web routes */
export function bindSocket(sock) {
    if (sock) global.__forgeSock = sock;
}
export default {
    command: 'bindsocket_internal',
    category: 'system',
    description: 'internal',
    async handler() {}
};
